import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'pathe'
import { parseToml, parseYaml, stringifyYaml } from '../parser'
import { hashing } from '../utils/hashing'
import { log } from '../utils/logger'
import { translate, TranslationRetryExceededError, TranslationRefusedError } from '../utils/translate'
import { updateAllUpstreams } from '../utils/upstream'
import { type GameType, shouldUseTransliteration, shouldUseTransliterationForKey } from '../utils/prompts'

// 번역 거부 항목 출력 파일 이름 접미사
const UNTRANSLATED_ITEMS_FILE_SUFFIX = 'untranslated-items.json'

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

interface ModTranslationsOptions {
  rootDir: string
  mods: string[]
  gameType: GameType
  onlyHash?: boolean
  timeoutMinutes?: number | false // false = 타임아웃 비활성화, undefined = 기본값(15분) 사용
}

interface ModMeta {
  upstream: {
    localization: string[];
    language: string;
  };
}

export interface UntranslatedItem {
  mod: string
  file: string
  key: string
  message: string
}

export interface TranslationResult {
  untranslatedItems: UntranslatedItem[]
}

export async function processModTranslations ({ rootDir, mods, gameType, onlyHash = false, timeoutMinutes }: ModTranslationsOptions): Promise<TranslationResult> {
  // 번역 작업 전에 해당 게임의 upstream 리포지토리만 업데이트
  log.start(`${gameType.toUpperCase()} Upstream 리포지토리 업데이트 중...`)
  const projectRoot = join(rootDir, '..') // rootDir은 ck3/ 같은 게임 디렉토리이므로 한 단계 위로
  await updateAllUpstreams(projectRoot, gameType)
  log.success(`${gameType.toUpperCase()} Upstream 리포지토리 업데이트 완료`)

  // 타임아웃 설정 (기본값: 15분)
  const timeoutMs = timeoutMinutes === false ? null : (timeoutMinutes ?? 15) * 60 * 1000
  const startTime = Date.now()
  
  if (timeoutMs === null) {
    log.info(`타임아웃 비활성화됨`)
  } else {
    log.info(`타임아웃 설정: ${timeoutMinutes ?? 15}분`)
  }

  const allUntranslatedItems: UntranslatedItem[] = []

  for (const mod of mods) {
    const processes: Promise<UntranslatedItem[]>[] = []
    log.start(`[${mod}] 작업 시작 (원본 파일 경로: ${rootDir}/${mod})`)
    const modDir = join(rootDir, mod)
    const metaPath = join(modDir, 'meta.toml')

    // `meta.toml`이 존재하지 않거나 디렉토리 등 파일이 아니면 무시
    if (!(await stat(metaPath)).isFile()) {
      continue
    }

    const metaContent = await readFile(metaPath, 'utf-8')
    const meta = parseToml(metaContent) as ModMeta
    log.debug(`[${mod}] 메타데이터:  upstream.language: ${meta.upstream.language}, upstream.localization: [${meta.upstream.localization}]`)

    for (const locPath of meta.upstream.localization) {
      const sourceDir = join(modDir, 'upstream', locPath)
      const localizationFolder = getLocalizationFolderName(gameType)
      const targetDir = join(modDir, 'mod', localizationFolder, sourceDir.includes('replace') ? 'korean/replace' : 'korean')

      // 모드 디렉토리 생성
      await mkdir(targetDir, { recursive: true })

      // upstream 디렉토리 존재 여부 확인
      try {
        await access(sourceDir)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(
            `[${mod}] upstream 디렉토리가 존재하지 않습니다: ${sourceDir}\n` +
            `meta.toml의 localization 경로를 확인하거나 upstream 업데이트가 실패했을 수 있습니다.\n` +
            `경로: ${locPath}`
          )
        }
        throw error
      }

      const sourceFiles = await readdir(sourceDir, { recursive: true })
      for (const file of sourceFiles) {
        // 언어파일 이름이 `_l_언어코드.yml` 형식이면 처리
        if (file.endsWith(`.yml`) && file.includes(`_l_${meta.upstream.language}`)) {
          processes.push(processLanguageFile(mod, sourceDir, targetDir, file, meta.upstream.language, gameType, onlyHash, startTime, timeoutMs))
        }
      }
    }

    try {
      const results = await Promise.all(processes)
      const untranslatedItems = results.flat()
      allUntranslatedItems.push(...untranslatedItems)
      log.success(`[${mod}] 번역 완료`)
      
      // 번역되지 않은 항목 요약 출력
      if (untranslatedItems.length > 0) {
        for (const item of untranslatedItems) {
          log.warn(`  [${item.mod}/${item.file}:${item.key}] "${item.message}"`)
        }
      } else if (!onlyHash) {
        log.success(`모든 항목이 성공적으로 번역되었습니다.`)
      }
    } catch (error) {
      if (error instanceof TimeoutReachedError) {
        log.warn(`[${mod}] 타임아웃으로 인해 번역 중단됨`)
        log.info(`타임아웃 도달: 처리된 작업까지 저장하고 종료합니다`)
        // 타임아웃 시에도 현재까지 수집된 항목 반환
        return saveAndReturnResult(projectRoot, gameType, allUntranslatedItems)
      }
      if (error instanceof TranslationRefusalStopError) {
        log.warn(`[${mod}] 번역 거부로 인해 번역 중단됨`)
        log.info(`번역 거부: 처리된 작업(${error.processedCount}/${error.totalEntries})까지 저장하고 종료합니다`)
        log.info(`거부 사유: ${error.originalError.reason}`)
        // 거부된 항목을 allUntranslatedItems에 추가
        allUntranslatedItems.push(error.refusedItem)
        // 거부된 항목을 포함하여 결과 반환
        return saveAndReturnResult(projectRoot, gameType, allUntranslatedItems)
      }
      throw error
    }
  }

  return saveAndReturnResult(projectRoot, gameType, allUntranslatedItems)
}

/**
 * 번역되지 않은 항목을 JSON 파일로 저장하고 결과를 반환합니다.
 */
async function saveAndReturnResult(
  projectRoot: string,
  gameType: GameType,
  untranslatedItems: UntranslatedItem[]
): Promise<TranslationResult> {
  const result: TranslationResult = { untranslatedItems }
  
  // 번역되지 않은 항목이 있는 경우에만 파일 저장
  if (untranslatedItems.length > 0) {
    const outputPath = join(projectRoot, `${gameType}-${UNTRANSLATED_ITEMS_FILE_SUFFIX}`)
    const outputData = {
      gameType,
      timestamp: new Date().toISOString(),
      items: untranslatedItems
    }
    await writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8')
    log.info(`번역되지 않은 항목 ${untranslatedItems.length}개가 ${outputPath}에 저장되었습니다.`)
  }
  
  return result
}

class TimeoutReachedError extends Error {
  constructor() {
    super('번역 타임아웃에 도달했습니다')
    this.name = 'TimeoutReachedError'
  }
}

/**
 * 번역 거부로 인해 번역이 중단되었을 때 발생하는 에러
 * 파일은 이미 저장된 상태이며, 이 에러는 상위에서 graceful exit을 수행하기 위해 사용됨
 */
class TranslationRefusalStopError extends Error {
  constructor(
    public readonly targetPath: string,
    public readonly processedCount: number,
    public readonly totalEntries: number,
    public readonly originalError: TranslationRefusedError,
    public readonly refusedItem: UntranslatedItem
  ) {
    super(`번역 거부로 중단: ${originalError.message}`)
    this.name = 'TranslationRefusalStopError'
  }
}

async function processLanguageFile (mode: string, sourceDir: string, targetBaseDir: string, file: string, sourceLanguage: string, gameType: GameType, onlyHash: boolean, startTime: number, timeoutMs: number | null): Promise<UntranslatedItem[]> {
  const sourcePath = join(sourceDir, file)
  const untranslatedItems: UntranslatedItem[] = []

  // 파일명을 기반으로 음역 모드 파일인지 감지
  const isTransliterationFile = shouldUseTransliteration(file)
  if (isTransliterationFile) {
    log.info(`[${mode}/${file}] 음역 대상 파일 감지 (파일명에 culture/dynasty/names 키워드 포함)`)
  }

  // 파일 순서를 최상위로 유지해 덮어쓸 수 있도록 앞에 '___'를 붙임 (ex: `___00_culture_l_english.yml`)
  const targetParentDir = join(targetBaseDir, dirname(file))
  await mkdir(targetParentDir, { recursive: true })
  const targetPath = join(targetParentDir, '___' + basename(file).replace(`_l_${sourceLanguage}.yml`, '_l_korean.yml'))

  let targetContent = ''
  try {
    targetContent = await readFile(targetPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    // 파일이 존재하지 않으면 원본에서 복사
    targetContent = await readFile(sourcePath, 'utf-8')
  }

  log.verbose(`[${mode}/${file}] 원본 파일 경로: ${sourcePath}`)

  const sourceContent = await readFile(sourcePath, 'utf-8')
  const sourceYaml: Record<string, Record<string, [string, string | null]>> = parseYaml(sourceContent)
  const targetYaml = parseYaml(targetContent)
  const newYaml: Record<`l_${string}`, Record<string, [string, string | null]>> = {
    l_korean: {}
  }

  log.verbose(`[${mode}/${file}] 원본 키 갯수: ${Object.keys(sourceContent).length}`)
  log.verbose(`[${mode}/${file}] 번역 키 갯수: ${Object.keys(targetContent).length}`)

  // 최상위 언어 코드 정의 변경
  const langKey = Object.keys(targetYaml)[0] || 'l_korean'
  if (langKey.startsWith('l_')) {
    log.verbose(`[${mode}/${file}] 언어 키 발견! "${langKey}" -> "l_korean"`)
  }

  const BATCH_SIZE = 1000 // 1,000 라인마다 파일에 저장
  let processedCount = 0
  const entries = Object.entries(sourceYaml[`l_${sourceLanguage}`])
  const totalEntries = entries.length

  for (const [key, [sourceValue]] of entries) {
    // 타임아웃 확인: 100회마다만 체크
    if (timeoutMs !== null && processedCount % 100 === 0 && Date.now() - startTime >= timeoutMs) {
      log.info(`[${mode}/${file}] 타임아웃 도달 (${processedCount}/${totalEntries} 처리됨)`)
      // 현재까지 작업 저장
      const updatedContent = stringifyYaml(newYaml)
      await writeFile(targetPath, updatedContent, 'utf-8')
      log.info(`[${mode}/${file}] 타임아웃으로 인한 중간 저장 완료`)
      throw new TimeoutReachedError()
    }

    const sourceHash = hashing(sourceValue)
    log.verbose(`[${mode}/${file}:${key}] 원본파일 문자열: ${sourceHash} | "${sourceValue}" `)

    const [targetValue, targetHash] = (targetYaml[langKey] && targetYaml[langKey][key]) || []

    // 해싱 처리용 유틸리티
    if (onlyHash) {
      newYaml.l_korean[key] = [targetValue, sourceHash]
      log.debug(`[${mode}/${file}:${key}] 해시 업데이트: ${targetHash} -> ${sourceHash}`)
      processedCount++
      continue
    }

    if (targetValue && (sourceHash === targetHash)) {
      log.verbose(`[${mode}/${file}:${key}] 번역파일 문자열: ${targetHash} | "${targetValue}" (번역됨)`)
      newYaml.l_korean[key] = [targetValue, targetHash]
      processedCount++
      continue
    }

    log.verbose(`[${mode}/${file}:${key}] 번역파일 문자열: ${targetHash} | "${targetValue}"`)

    // 음역 모드 결정: 파일 레벨 우선, 그 다음 키 레벨 검사
    const shouldTransliterate = isTransliterationFile || shouldUseTransliterationForKey(key)
    
    // 키 레벨 음역 모드가 활성화된 경우 로그 출력
    if (!isTransliterationFile && shouldTransliterate) {
      log.verbose(`[${mode}/${file}:${key}] 키 레벨 음역 모드 활성화됨 (키가 _adj 또는 _name으로 끝남)`)
    }

    // 번역 요청 (음역 모드 플래그 전달)
    log.verbose(`[${mode}/${file}:${key}] ${shouldTransliterate ? '음역' : '번역'} 요청: ${sourceHash} | "${sourceValue}"`)
    let translatedValue: string
    let hashForEntry: string | null = sourceHash

    try {
      translatedValue = await translate(sourceValue, gameType, 0, undefined, shouldTransliterate)
    } catch (error) {
      if (error instanceof TranslationRetryExceededError) {
        log.warn(`[${mode}/${file}:${key}] 번역 재시도 초과, 원문을 유지합니다.`)
        translatedValue = sourceValue
        hashForEntry = null
        // 번역되지 않은 항목 추적
        untranslatedItems.push({
          mod: mode,
          file,
          key,
          message: sourceValue
        })
      } else if (error instanceof TranslationRefusedError) {
        // 번역 거부 시 현재까지 작업 저장 후 중단
        log.warn(`[${mode}/${file}:${key}] 번역 거부됨: ${error.reason}`)
        log.info(`[${mode}/${file}] 번역 거부로 인해 현재까지 작업(${processedCount}/${totalEntries})을 저장합니다.`)
        const updatedContent = stringifyYaml(newYaml)
        await writeFile(targetPath, updatedContent, 'utf-8')
        // 거부된 항목을 에러와 함께 전달
        const refusedItem: UntranslatedItem = {
          mod: mode,
          file,
          key,
          message: `${sourceValue} (번역 거부: ${error.reason})`
        }
        throw new TranslationRefusalStopError(targetPath, processedCount, totalEntries, error, refusedItem)
      } else {
        throw error
      }
    }

    newYaml.l_korean[key] = [translatedValue, hashForEntry]
    processedCount++

    // 1,000 라인마다 중간 저장
    if (processedCount % BATCH_SIZE === 0) {
      const updatedContent = stringifyYaml(newYaml)
      await writeFile(targetPath, updatedContent, 'utf-8')
      log.info(`[${mode}/${file}] 중간 저장 완료 (${processedCount}/${totalEntries} 처리됨)`)
    }
  }

  // 최종 저장
  const updatedContent = stringifyYaml(newYaml)
  await writeFile(targetPath, updatedContent, 'utf-8')
  log.debug(`[${mode}/${file}] 번역 완료 (번역 파일 위치: ${targetPath})`)
  
  return untranslatedItems
}
