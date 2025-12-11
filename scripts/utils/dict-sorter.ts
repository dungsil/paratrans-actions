/**
 * 단어 사전 정렬 유틸리티
 * TOML 형식의 단어 사전 파일을 주석 블록 단위로 그룹화하고 알파벳 순으로 정렬합니다.
 */

export interface DictionaryEntry {
  key: string
  value: string
  inlineComment?: string
}

export interface CommentBlock {
  comments: string[]
  entries: DictionaryEntry[]
}

// TOML 키-값 쌍을 매칭하는 정규식
// 형식: "key" = "value" 또는 key = value (따옴표 선택적)
// 선택적으로 # 인라인 주석 포함
// 그룹 1: 키 (따옴표 포함 가능)
// 그룹 2: 값 (따옴표 포함 가능)
// 그룹 3: 인라인 주석 (선택적)
const TOML_KEY_VALUE_PATTERN = /^("(?:[^"\\]|\\.)*"|[^=]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^#]+)(#.*)?$/

/**
 * TOML 파일을 파싱하여 주석 블록으로 그룹화합니다.
 * @param content TOML 파일 내용
 * @returns 주석 블록 배열
 */
export function parseTomlWithComments(content: string): CommentBlock[] {
  const lines = content.split('\n')
  const blocks: CommentBlock[] = []
  let currentBlock: CommentBlock = { comments: [], entries: [] }
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // 빈 줄은 현재 블록을 완성하고 새 블록 시작
    if (trimmedLine === '') {
      if (currentBlock.comments.length > 0 || currentBlock.entries.length > 0) {
        blocks.push(currentBlock)
        currentBlock = { comments: [], entries: [] }
      }
      continue
    }
    
    // 주석 라인
    if (trimmedLine.startsWith('#')) {
      currentBlock.comments.push(line)
      continue
    }
    
    // TOML 키-값 쌍 파싱
    const match = trimmedLine.match(TOML_KEY_VALUE_PATTERN)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      const inlineComment = match[3]?.trim()
      
      currentBlock.entries.push({
        key,
        value,
        inlineComment
      })
    }
  }
  
  // 마지막 블록 추가
  if (currentBlock.comments.length > 0 || currentBlock.entries.length > 0) {
    blocks.push(currentBlock)
  }
  
  return blocks
}

/**
 * 키를 정규화하여 정렬에 사용합니다.
 * 따옴표를 제거하고 소문자로 변환합니다.
 * @param key TOML 키
 * @returns 정규화된 키
 */
export function normalizeKeyForSorting(key: string): string {
  // 따옴표 제거
  const unquoted = key.replace(/^"(.*)"$/, '$1')
  // 소문자로 변환
  return unquoted.toLowerCase()
}

/**
 * 주석 블록 내의 엔트리를 알파벳 순으로 정렬합니다.
 * Schwartzian transform을 사용하여 성능을 최적화합니다.
 * @param blocks 주석 블록 배열
 * @returns 정렬된 주석 블록 배열
 */
export function sortBlocks(blocks: CommentBlock[]): CommentBlock[] {
  return blocks.map(block => {
    // Schwartzian transform: 정규화된 키를 미리 계산하여 중복 호출 방지
    const entriesWithKeys = block.entries.map(entry => ({
      entry,
      normalizedKey: normalizeKeyForSorting(entry.key)
    }))
    
    entriesWithKeys.sort((a, b) => 
      a.normalizedKey.localeCompare(b.normalizedKey, 'en')
    )
    
    return {
      ...block,
      entries: entriesWithKeys.map(item => item.entry)
    }
  })
}

/**
 * 정렬된 주석 블록을 TOML 형식의 문자열로 변환합니다.
 * @param blocks 주석 블록 배열
 * @returns TOML 형식 문자열
 */
export function blocksToToml(blocks: CommentBlock[]): string {
  const result: string[] = []
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    
    // 주석 추가
    if (block.comments.length > 0) {
      result.push(...block.comments)
    }
    
    // 엔트리 추가
    for (const entry of block.entries) {
      let line = `${entry.key} = ${entry.value}`
      if (entry.inlineComment) {
        line += ` ${entry.inlineComment}`
      }
      result.push(line)
    }
    
    // 블록 사이에 빈 줄 추가 (마지막 블록 제외)
    if (i < blocks.length - 1) {
      result.push('')
    }
  }
  
  return result.join('\n') + '\n'
}
