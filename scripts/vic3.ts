import process from 'node:process'
import { readdir } from 'node:fs/promises'
import { join } from 'pathe'
import { processModTranslations } from './factory/translate'
import { invalidateDictionaryTranslations } from './utils/dictionary-invalidator'
import { invalidateIncorrectTranslations } from './utils/retranslation-invalidator'
import { migrateToTransliteration } from './utils/transliteration-migrator'
import { getChangedDictionaryKeys } from './utils/dictionary-changes'
import { parseDictionaryFilterArgs } from './utils/cli-args'
import { log } from './utils/logger'
import { isSqliteIOError } from './utils/cache'
import { getDiskUsageString } from './utils/disk-usage'
import { filterMods } from './utils/mod-filter'

async function main () {
  try {
    const vic3Dir = join(import.meta.dirname, '..', 'vic3')
    const allMods = await readdir(vic3Dir)
    const onlyHash = process.argv?.[2] === 'onlyHash'
    const updateDict = process.argv?.[2] === 'updateDict'
    const retranslate = process.argv?.[2] === 'retranslate'
    const migrateTransliteration = process.argv?.[2] === 'migrateToTransliteration'
    
    // 특정 모드가 지정된 경우 해당 모드만 처리
    const mods = filterMods(allMods, process.argv?.[3])

    // 타임아웃 설정: 환경변수 TRANSLATION_TIMEOUT_MINUTES 또는 false(비활성화)
    // 환경변수가 'false' 또는 '0'이면 타임아웃 비활성화
    const timeoutEnv = process.env.TRANSLATION_TIMEOUT_MINUTES
    let timeoutMinutes: number | false | undefined = undefined // undefined = 기본값 사용
    if (timeoutEnv === 'false' || timeoutEnv === '0') {
      timeoutMinutes = false // 타임아웃 비활성화
    } else if (timeoutEnv) {
      const parsed = parseInt(timeoutEnv, 10)
      if (!isNaN(parsed) && parsed > 0) {
        timeoutMinutes = parsed
      }
    }

    if (updateDict) {
      // CLI 인자 파싱: --since-commit, --commit-range, --since-date
      const filterArgs = parseDictionaryFilterArgs(process.argv.slice(3))
      
      // 필터링 옵션이 지정되었을 경우, 변경된 키만 추출
      let filterKeys: string[] | undefined
      if (filterArgs.hasFilterOptions) {
        filterKeys = await getChangedDictionaryKeys('vic3', filterArgs)
        
        if (filterKeys.length === 0) {
          log.info('지정한 커밋/날짜 범위에 변경된 딕셔너리 키가 없습니다. 이는 (1) 해당 범위에 변경이 없거나, (2) 범위가 잘못 지정된 경우일 수 있습니다. 무효화를 건너뜁니다.')
          return
        }
      }
      
      log.box(
        `
        VIC3 단어사전 기반 번역 무효화
        - 대상 경로: ${vic3Dir}
        - 대상 모드 (${mods.length}개): ${mods}
        ${filterKeys ? `- 필터링된 키: ${filterKeys.length}개` : '- 전체 딕셔너리 사용'}
        `,
      )
      
      await invalidateDictionaryTranslations('vic3', vic3Dir, mods, filterKeys)
      
      log.success(`단어사전 기반 번역 무효화 완료!`)
    } else if (retranslate) {
      log.box(
        `
        VIC3 잘못 번역된 항목 재번역
        - 대상 경로: ${vic3Dir}
        - 대상 모드 (${mods.length}개): ${mods}
        `,
      )
      
      await invalidateIncorrectTranslations('vic3', vic3Dir, mods)
      
      log.success(`잘못 번역된 항목 무효화 완료!`)
    } else if (migrateTransliteration) {
      log.box(
        `
        VIC3 음역 마이그레이션
        - 대상 경로: ${vic3Dir}
        - 대상 모드 (${mods.length}개): ${mods}
        - 처리 대상: culture, dynasty, names 관련 파일
        `,
      )
      
      await migrateToTransliteration('vic3', vic3Dir, mods)
      
      log.success(`음역 마이그레이션 완료!`)
    } else {
      log.box(
        `
        VIC3 번역 스크립트 구동
        - 번역 대상 경로: ${vic3Dir}
        - 번역 대상 모드 (${mods.length}개): ${mods}
        `,
      )

      await processModTranslations({
        rootDir: vic3Dir,
        mods,
        gameType: 'vic3',
        onlyHash,
        timeoutMinutes
      })

      log.success(`번역 완료! 스크립트를 종료합니다. (처리된 모드: ${mods})`)
    }
  } catch (error) {
    // SQLite I/O 오류인 경우 디스크 사용률 정보 추가
    if (isSqliteIOError(error)) {
      const diskUsage = getDiskUsageString()
      if (diskUsage) {
        log.warn(diskUsage)
      }
    }
    throw new Error(`VIC3 번역 처리 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error
    })
  }
}

main().catch((error) => {
  log.error('번역 도중 오류가 발생하였습니다.', error)
  process.exit(1)
})