import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, parse } from 'pathe'
import { parseToml, parseYaml, stringifyYaml } from '../parser'
import { log } from './logger'
import { type GameType, shouldUseTransliteration } from './prompts'
import { validateTranslationEntries } from './translation-validator'

interface ModMeta {
  upstream: {
    localization: string[]
    language: string
  }
}

/**
 * 잘못 번역된 항목들을 찾아 해시를 초기화합니다.
 * 이렇게 하면 다음 번역 시 올바르게 재번역됩니다.
 * @param gameType 게임 타입 (ck3, vic3, stellaris)
 * @param rootDir 루트 디렉토리 경로
 * @param targetMods 처리할 모드 목록 (선택사항, 미지정시 전체 모드 처리)
 */
export async function invalidateIncorrectTranslations(gameType: GameType, rootDir: string, targetMods?: string[]): Promise<void> {
  log.start(`[${gameType.toUpperCase()}] 잘못된 번역 무효화 시작`)
  log.info(`대상 디렉토리: ${rootDir}`)

  const mods = targetMods ?? await readdir(rootDir)
  log.info(`대상 모드: [${mods.join(', ')}]`)

  let totalInvalidated = 0

  for (const mod of mods) {
    const modDir = join(rootDir, mod)
    const metaPath = join(modDir, 'meta.toml')

    log.info(`[${mod}] 처리 시작`)
    log.debug(`[${mod}] meta.toml 경로: ${metaPath}`)

    try {
      const metaContent = await readFile(metaPath, 'utf-8')
      const meta = parseToml(metaContent) as ModMeta

      log.debug(`[${mod}] 메타데이터 읽기 성공`)
      log.debug(`[${mod}] upstream.language: ${meta.upstream.language}`)
      log.debug(`[${mod}] upstream.localization: [${meta.upstream.localization.join(', ')}]`)

      for (const locPath of meta.upstream.localization) {
        log.info(`[${mod}] localization 경로 처리: ${locPath}`)
        const invalidatedCount = await invalidateModLocalization(mod, modDir, locPath, meta.upstream.language, gameType)
        totalInvalidated += invalidatedCount
        log.info(`[${mod}/${locPath}] 무효화된 항목: ${invalidatedCount}개`)
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

  log.success(`잘못된 번역 무효화 완료 - 총 ${totalInvalidated}개 항목 무효화`)
}

async function invalidateModLocalization(
  modName: string,
  modDir: string,
  locPath: string,
  sourceLanguage: string,
  gameType: GameType
): Promise<number> {
  const sourceDir = join(modDir, 'upstream', locPath)
  const targetDir = join(modDir, 'mod', getLocalizationFolderName(gameType), locPath.includes('replace') ? 'korean/replace' : 'korean')

  log.debug(`[${modName}] 소스 디렉토리: ${sourceDir}`)
  log.debug(`[${modName}] 타겟 디렉토리: ${targetDir}`)

  try {
    const sourceFiles = await readdir(sourceDir, { recursive: true })
    log.debug(`[${modName}] 소스 파일들: [${sourceFiles.join(', ')}]`)

    let invalidatedCount = 0

    for (const file of sourceFiles) {
      if (file.endsWith(`_l_${sourceLanguage}.yml`)) {
        const sourceFilePath = join(sourceDir, file)
        const { dir, base } = parse(file)
        const targetFileName = '___' + base.replace(`_l_${sourceLanguage}.yml`, '_l_korean.yml')
        const targetRelativePath = dir ? join(dir, targetFileName) : targetFileName
        const targetFilePath = join(targetDir, targetRelativePath)

        // 파일명으로 음역 모드 판단
        const useTransliteration = shouldUseTransliteration(file)
        if (useTransliteration) {
          log.debug(`[${modName}] 음역 모드 파일: ${file}`)
        }

        log.debug(`[${modName}] 처리할 파일: ${file}`)
        log.debug(`[${modName}] 소스: ${sourceFilePath}`)
        log.debug(`[${modName}] 타겟: ${targetFilePath}`)

        const count = await invalidateTranslationFile(modName, sourceFilePath, targetFilePath, gameType)
        invalidatedCount += count
        log.debug(`[${modName}/${file}] 무효화된 항목: ${count}개`)
      }
    }

    return invalidatedCount
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log.warn(`[${modName}] 소스 디렉토리 없음: ${sourceDir}`)
      return 0
    }
    log.error(`[${modName}] 디렉토리 읽기 오류:`, error)
    throw error
  }
}

async function invalidateTranslationFile(
  modName: string,
  sourceFilePath: string,
  targetFilePath: string,
  gameType: GameType
): Promise<number> {
  try {
    log.debug(`[${modName}] 파일 처리 시작: ${sourceFilePath}`)

    // 원본 파일 읽기
    const sourceContent = await readFile(sourceFilePath, 'utf-8')
    const sourceYaml = parseYaml(sourceContent) as Record<string, Record<string, [string, string]>>

    // 번역 파일 읽기 (없으면 건너뜀)
    let targetContent: string
    try {
      targetContent = await readFile(targetFilePath, 'utf-8')
      log.debug(`[${modName}] 번역 파일 읽기 성공: ${targetFilePath}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.debug(`[${modName}] 번역 파일 없음: ${targetFilePath}`)
        return 0 // 번역 파일이 없으면 무효화할 게 없음
      }
      throw error
    }

    const targetYaml = parseYaml(targetContent) as Record<string, Record<string, [string, string]>>

    let invalidatedCount = 0
    let hasChanges = false

    // 원본 파일의 언어 키 찾기
    const sourceLangKey = Object.keys(sourceYaml)[0]
    if (!sourceLangKey || !sourceLangKey.startsWith('l_')) {
      log.debug(`[${modName}] 원본 파일에 언어 키 없음: ${sourceLangKey}`)
      return 0
    }

    // 번역 파일의 언어 키 찾기
    const targetLangKey = Object.keys(targetYaml)[0]
    if (!targetLangKey || !targetLangKey.startsWith('l_')) {
      log.debug(`[${modName}] 번역 파일에 언어 키 없음: ${targetLangKey}`)
      return 0
    }

    log.debug(`[${modName}] 원본 키 개수: ${Object.keys(sourceYaml[sourceLangKey]).length}`)
    log.debug(`[${modName}] 번역 키 개수: ${Object.keys(targetYaml[targetLangKey]).length}`)

    // 번역 검증 수행
    const invalidEntries = validateTranslationEntries(
      sourceYaml[sourceLangKey],
      targetYaml[targetLangKey],
      gameType
    )

    // 잘못된 번역에 대해 해시 초기화
    for (const entry of invalidEntries) {
      const [currentTranslation] = targetYaml[targetLangKey][entry.key]
      targetYaml[targetLangKey][entry.key] = [currentTranslation, ''] // 해시 초기화
      invalidatedCount++
      hasChanges = true

      log.info(`[${modName}] 무효화: "${entry.sourceValue}" -> "${entry.translatedValue}" (사유: ${entry.reason})`)
    }

    if (hasChanges) {
      const updatedContent = stringifyYaml(targetYaml)
      await writeFile(targetFilePath, updatedContent, 'utf-8')
      log.debug(`[${modName}] 파일 업데이트 완료: ${targetFilePath}`)
    } else {
      log.debug(`[${modName}] 변경사항 없음`)
    }

    return invalidatedCount
  } catch (error) {
    log.error(`[${modName}] 파일 처리 실패: ${sourceFilePath} -> ${targetFilePath}`, error)
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
