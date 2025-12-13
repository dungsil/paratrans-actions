import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { log } from './logger'

const execAsync = promisify(exec)

export interface TransliterationFileChange {
  modPath: string
  addedFiles: string[]
  removedFiles: string[]
}

/**
 * Git diff를 파싱하여 meta.toml에서 변경된 transliteration_files를 추출합니다.
 * @param commitId 비교할 커밋 ID (예: HEAD, abc123)
 * @returns 변경된 파일들의 목록
 */
export async function getChangedTransliterationFiles(commitId: string): Promise<TransliterationFileChange[]> {
  log.info(`transliteration_files 변경사항 확인 중 (커밋: ${commitId})`)

  // commitId 검증 (command injection 방지)
  // Git ref 형식만 허용: 알파벳, 숫자, ~, ^, -, _, /, . 
  if (!/^[a-zA-Z0-9~^_.\/-]+$/.test(commitId)) {
    throw new Error(`Invalid commit ID format: ${commitId}`)
  }

  try {
    // meta.toml 파일의 변경사항 가져오기
    const { stdout: diffOutput } = await execAsync(
      `git diff ${commitId}~1 ${commitId} -- "**/meta.toml"`,
      { maxBuffer: 10 * 1024 * 1024 }
    )

    if (!diffOutput.trim()) {
      log.info('meta.toml 변경사항이 없습니다.')
      return []
    }

    const changes: TransliterationFileChange[] = []
    
    // diff를 파일별로 분리
    const fileDiffs = diffOutput.split('diff --git')
    
    for (const fileDiff of fileDiffs) {
      if (!fileDiff.trim()) continue
      
      // 파일 경로 추출
      const pathMatch = fileDiff.match(/a\/(.*?\/meta\.toml)/)
      if (!pathMatch) continue
      
      const modPath = pathMatch[1].replace('/meta.toml', '')
      
      // transliteration_files 섹션의 변경사항 추적
      const addedFiles: string[] = []
      const removedFiles: string[] = []
      
      let inTransliterationSection = false
      const lines = fileDiff.split('\n')
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // transliteration_files 섹션 시작 감지 (TOML 키 선언만 매칭)
        if (/^[-+]?\s*transliteration_files\s*=/.test(line)) {
          inTransliterationSection = true
          continue
        }
        
        // 섹션 종료 감지 (빈 줄, 배열 종료(]), 또는 다른 섹션 시작([...]))
        if (
          inTransliterationSection &&
          (
            (line.match(/^[-+]?\s*$/) && !line.includes('"')) || // 빈 줄
            line.match(/^[-+]?\s*\]\s*$/) ||                     // 배열 종료 ]
            line.match(/^[-+]?\s*\[[^\]]+\]\s*$/)                // 새 섹션 시작 (TOML table header)
          )
        ) {
          inTransliterationSection = false
          continue
        }
        
        if (inTransliterationSection) {
          // 추가된 파일 (+ 로 시작)
          const addMatch = line.match(/^\+\s*"([^"]+)"/)
          if (addMatch) {
            addedFiles.push(addMatch[1])
          }
          
          // 제거된 파일 (- 로 시작)
          const removeMatch = line.match(/^-\s*"([^"]+)"/)
          if (removeMatch) {
            removedFiles.push(removeMatch[1])
          }
        }
      }
      
      if (addedFiles.length > 0 || removedFiles.length > 0) {
        changes.push({ modPath, addedFiles, removedFiles })
        log.info(`[${modPath}] 추가: ${addedFiles.length}개, 제거: ${removedFiles.length}개`)
      }
    }

    return changes
  } catch (error) {
    log.error('transliteration_files 변경사항 확인 실패:', error)
    throw error
  }
}
