import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, parse } from 'pathe'
import { parseToml, parseYaml, stringifyYaml } from '../parser'
import { log } from './logger'
import { type GameType, shouldUseTransliteration } from './prompts'

interface ModMeta {
  upstream: {
    localization: string[]
    language: string
  }
}

/**
 * PR #1 이전에 의미 기반 번역된 파일들 중 음역 대상 파일의 해시를 초기화합니다.
 * 이렇게 하면 다음 번역 시 음역 모드로 재번역됩니다.
 * 
 * 처리 대상:
 * - culture, cultures: 문화명 파일
 * - dynasty, dynasties: 왕조명 파일
 * - names, character_name, name_list: 인물명 파일
 * 
 * @param gameType 게임 타입 (ck3, vic3, stellaris)
 * @param rootDir 루트 디렉토리 경로
 * @param targetMods 처리할 모드 목록 (선택사항, 미지정시 전체 모드 처리)
 */
export async function migrateToTransliteration(
  gameType: GameType,
  rootDir: string,
  targetMods?: string[]
): Promise<void> {
  log.start(`[${gameType.toUpperCase()}] 음역 마이그레이션 시작`)
  log.info(`대상 디렉토리: ${rootDir}`)
  log.info(`음역 대상: culture, dynasty, names 관련 파일`)

  const mods = targetMods ?? await readdir(rootDir)
  log.info(`대상 모드: [${mods.join(', ')}]`)

  let totalFiles = 0
  let totalInvalidated = 0

  for (const mod of mods) {
    const modDir = join(rootDir, mod)
    const metaPath = join(modDir, 'meta.toml')

    log.info(`[${mod}] 처리 시작`)

    try {
      const metaContent = await readFile(metaPath, 'utf-8')
      const meta = parseToml(metaContent) as ModMeta

      for (const locPath of meta.upstream.localization) {
        log.info(`[${mod}] localization 경로 처리: ${locPath}`)
        const result = await migrateModLocalization(
          mod,
          modDir,
          locPath,
          meta.upstream.language,
          gameType
        )
        
        totalFiles += result.files
        totalInvalidated += result.invalidated
        
        if (result.files > 0) {
          log.info(`[${mod}/${locPath}] 처리: ${result.files}개 파일, ${result.invalidated}개 항목 무효화`)
        }
      }

      log.success(`[${mod}] 완료`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.debug(`[${mod}] meta.toml 없음, 건너뛰기`)
        continue
      }
      log.error(`[${mod}] 오류 발생:`, error)
      throw error
    }
  }

  log.success(
    `음역 마이그레이션 완료 - ${totalFiles}개 파일에서 총 ${totalInvalidated}개 항목 무효화`
  )
}

async function migrateModLocalization(
  modName: string,
  modDir: string,
  locPath: string,
  sourceLanguage: string,
  gameType: GameType
): Promise<{ files: number; invalidated: number }> {
  const sourceDir = join(modDir, 'upstream', locPath)
  const targetDir = join(
    modDir,
    'mod',
    getLocalizationFolderName(gameType),
    locPath.includes('replace') ? 'korean/replace' : 'korean'
  )

  try {
    const sourceFiles = await readdir(sourceDir, { recursive: true })
    
    let processedFiles = 0
    let totalInvalidated = 0

    for (const file of sourceFiles) {
      if (file.endsWith(`_l_${sourceLanguage}.yml`)) {
        // 파일명으로 음역 모드 판단
        const useTransliteration = shouldUseTransliteration(file)
        
        // 음역 대상 파일만 처리
        if (!useTransliteration) {
          continue
        }

        const sourceFilePath = join(sourceDir, file)
        const { dir, base } = parse(file)
        const targetFileName = '___' + base.replace(`_l_${sourceLanguage}.yml`, '_l_korean.yml')
        const targetRelativePath = dir ? join(dir, targetFileName) : targetFileName
        const targetFilePath = join(targetDir, targetRelativePath)

        log.debug(`[${modName}] 음역 대상 파일 처리: ${file}`)

        const invalidatedCount = await migrateTranslationFile(
          modName,
          targetFilePath
        )
        
        if (invalidatedCount > 0) {
          processedFiles++
          totalInvalidated += invalidatedCount
          log.info(`[${modName}/${file}] ${invalidatedCount}개 항목 무효화`)
        }
      }
    }

    return { files: processedFiles, invalidated: totalInvalidated }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log.warn(`[${modName}] 소스 디렉토리 없음: ${sourceDir}`)
      return { files: 0, invalidated: 0 }
    }
    throw error
  }
}

async function migrateTranslationFile(
  modName: string,
  targetFilePath: string
): Promise<number> {
  try {
    // 번역 파일 읽기 (없으면 건너뜀)
    let targetContent: string
    try {
      targetContent = await readFile(targetFilePath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.debug(`[${modName}] 번역 파일 없음: ${targetFilePath}`)
        return 0 // 번역 파일이 없으면 무효화할 게 없음
      }
      throw error
    }

    const targetYaml = parseYaml(targetContent) as Record<string, Record<string, [string, string]>>

    // 번역 파일의 언어 키 찾기
    const targetLangKey = Object.keys(targetYaml)[0]
    if (!targetLangKey || !targetLangKey.startsWith('l_')) {
      log.debug(`[${modName}] 번역 파일에 언어 키 없음: ${targetLangKey}`)
      return 0
    }

    let invalidatedCount = 0
    let hasChanges = false

    // 모든 항목의 해시를 초기화 (이미 번역된 항목만)
    for (const [key, [translationValue, translationHash]] of Object.entries(targetYaml[targetLangKey])) {
      // 번역값이 있고 해시도 있는 경우에만 무효화
      if (translationValue && translationHash && translationHash !== '') {
        targetYaml[targetLangKey][key] = [translationValue, null]
        invalidatedCount++
        hasChanges = true
      }
    }

    if (hasChanges) {
      const updatedContent = stringifyYaml(targetYaml)
      await writeFile(targetFilePath, updatedContent, 'utf-8')
      log.debug(`[${modName}] 파일 업데이트 완료: ${targetFilePath}`)
    } else {
      log.debug(`[${modName}] 변경사항 없음 (미번역 또는 이미 무효화됨)`)
    }

    return invalidatedCount
  } catch (error) {
    log.error(`[${modName}] 파일 처리 실패: ${targetFilePath}`, error)
    return 0
  }
}

function getLocalizationFolderName(gameType: GameType): string {
  switch (gameType) {
    case 'ck3':
    case 'vic3':
      return 'localization'
    case 'stellaris':
      return 'localisation'
    default:
      throw new Error(`Unsupported game type: ${gameType}`)
  }
}
