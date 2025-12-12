import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
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
      const processedFiles: string[] = []
      
      for (const file of sourceFiles) {
        // 언어파일 이름이 `_l_언어코드.yml` 형식이면 처리
        if (file.endsWith(`.yml`) && file.includes(`_l_${meta.upstream.language}`)) {
          processes.push(processLanguageFile(mod, sourceDir, targetDir, file, meta.upstream.language, gameType, onlyHash, startTime, timeoutMs))
          // 처리된 파일 추적 (한국어 파일명으로 변환)
          const targetParentDir = join(targetDir, dirname(file))
          const targetFileName = '___' + basename(file).replace(`_l_${meta.upstream.language}.yml`, '_l_korean.yml')
          processedFiles.push(join(targetParentDir, targetFileName))
        }
      }
      
      // 업스트림에서 삭제된 파일 정리 (한국어 번역 파일 삭제)
      await cleanupOrphanedFiles(targetDir, processedFiles, mod, locPath)
    }

    // Promise.allSettled를 사용하여 모든 파일 처리가 완료될 때까지 대기
    // 일부 파일에서 번역 거부가 발생해도 다른 파일들의 결과를 모두 수집
    const results = await Promise.allSettled(processes)
    
    const untranslatedItems: UntranslatedItem[] = []
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        // 성공한 경우: 번역되지 않은 항목들을 수집
        untranslatedItems.push(...result.value)
      } else {
        // 실패한 경우: 에러 타입에 따라 처리
        const error = result.reason
        if (error instanceof TimeoutReachedError) {
          log.warn(`[${mod}] 타임아웃으로 인해 번역 중단됨`)
          log.info(`타임아웃 도달: 처리된 작업까지 저장하고 종료합니다`)
          // 타임아웃 시에도 현재까지 수집된 항목 반환
          allUntranslatedItems.push(...untranslatedItems)
          return saveAndReturnResult(projectRoot, gameType, allUntranslatedItems)
        } else {
          // 다른 예외는 그대로 throw
          throw error
        }
      }
    }
    
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

/**
 * 업스트림에서 삭제된 파일에 해당하는 한국어 번역 파일을 삭제합니다.
 * @param targetDir 한국어 번역 파일이 위치한 디렉토리
 * @param processedFiles 현재 처리된 파일 경로 목록 (절대 경로)
 * @param mod 모드 이름
 * @param locPath 로케일 경로
 */
async function cleanupOrphanedFiles(targetDir: string, processedFiles: string[], mod: string, locPath: string): Promise<void> {
  try {
    // targetDir 디렉토리가 존재하는지 확인
    await access(targetDir)
  } catch (error) {
    // 디렉토리가 없으면 정리할 파일도 없음
    return
  }

  // targetDir의 모든 한국어 번역 파일 목록 가져오기
  const targetFiles = await readdir(targetDir, { recursive: true })
  const koreanFiles = targetFiles.filter(file => 
    file.endsWith('_l_korean.yml') && file.includes('___')
  )

  // processedFiles를 Set으로 변환하여 빠른 검색
  const processedSet = new Set(processedFiles)

  // 업스트림에 없는 한국어 파일 삭제
  for (const file of koreanFiles) {
    const fullPath = join(targetDir, file)
    
    if (!processedSet.has(fullPath)) {
      log.info(`[${mod}/${locPath}] 업스트림에서 삭제된 파일 정리: ${file}`)
      try {
        await rm(fullPath, { force: true })
        log.debug(`[${mod}/${locPath}] 파일 삭제 완료: ${fullPath}`)
      } catch (error) {
        log.warn(`[${mod}/${locPath}] 파일 삭제 실패: ${fullPath} - ${error}`)
      }
    }
  }
}

class TimeoutReachedError extends Error {
  constructor() {
    super('번역 타임아웃에 도달했습니다')
    this.name = 'TimeoutReachedError'
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
        // 번역 거부 시 원문을 유지하고 계속 진행
        log.warn(`[${mode}/${file}:${key}] 번역 거부됨: ${error.reason}`)
        log.info(`[${mode}/${file}:${key}] 원문을 유지하고 다음 항목으로 계속 진행합니다.`)
        translatedValue = sourceValue
        hashForEntry = null
        // 번역되지 않은 항목 추적
        untranslatedItems.push({
          mod: mode,
          file,
          key,
          message: `${sourceValue} (번역 거부: ${error.reason})`
        })
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
  // 빈 파일 생성 방지: l_korean 객체가 비어있으면 파일을 쓰지 않음
  const hasEntries = Object.keys(newYaml.l_korean).length > 0
  
  if (!hasEntries) {
    log.warn(`[${mode}/${file}] 번역할 항목이 없습니다. 파일을 생성하지 않습니다.`)
    // 기존 파일이 있다면 삭제 (업스트림에서 내용이 모두 삭제된 경우)
    try {
      await access(targetPath)
      await rm(targetPath, { force: true })
      log.info(`[${mode}/${file}] 빈 파일 삭제: ${targetPath}`)
    } catch (error) {
      // 파일이 없으면 무시
    }
  } else {
    const updatedContent = stringifyYaml(newYaml)
    await writeFile(targetPath, updatedContent, 'utf-8')
    log.debug(`[${mode}/${file}] 번역 완료 (번역 파일 위치: ${targetPath})`)
  }
  
  return untranslatedItems
}
