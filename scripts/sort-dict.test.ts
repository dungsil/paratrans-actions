import { describe, it, expect } from 'vitest'
import { 
  parseTomlWithComments, 
  sortBlocks, 
  blocksToToml
} from './utils/dict-sorter'

describe('sort-dict CLI 통합 테스트', () => {
  describe('전체 파이프라인 테스트', () => {
    it('정렬되지 않은 딕셔너리를 정렬해야 함', () => {
      const content = `# 게임 용어
"king" = "왕"
"duke" = "공작"
"character" = "인물"

# 일반 표현
"ok" = "네"
"excellent" = "훌륭하군"`

      const blocks = parseTomlWithComments(content)
      const sorted = sortBlocks(blocks)
      const result = blocksToToml(sorted)

      const expected = `# 게임 용어
"character" = "인물"
"duke" = "공작"
"king" = "왕"

# 일반 표현
"excellent" = "훌륭하군"
"ok" = "네"
`

      expect(result).toBe(expected)
    })

    it('인라인 주석이 있는 딕셔너리를 정렬해야 함', () => {
      const content = `# 테스트
"zzz" = "마지막"
"aaa" = "첫번째" # 중요한 항목
"bbb" = "두번째"`

      const blocks = parseTomlWithComments(content)
      const sorted = sortBlocks(blocks)
      const result = blocksToToml(sorted)

      const expected = `# 테스트
"aaa" = "첫번째" # 중요한 항목
"bbb" = "두번째"
"zzz" = "마지막"
`

      expect(result).toBe(expected)
    })

    it('여러 주석 블록이 있는 딕셔너리를 정렬해야 함', () => {
      const content = `# 블록 1
"c" = "3"
"a" = "1"

# 블록 2
# 추가 설명
"z" = "26"
"x" = "24"

# 블록 3
"m" = "13"`

      const blocks = parseTomlWithComments(content)
      const sorted = sortBlocks(blocks)
      const result = blocksToToml(sorted)

      // 각 블록이 독립적으로 정렬되는지 확인
      expect(result).toContain('"a" = "1"\n"c" = "3"')
      expect(result).toContain('"x" = "24"\n"z" = "26"')
      expect(result).toContain('"m" = "13"')
    })

    it('이미 정렬된 딕셔너리는 변경하지 않아야 함', () => {
      const content = `# 정렬된 블록
"a" = "1"
"b" = "2"
"c" = "3"
`

      const blocks = parseTomlWithComments(content)
      const sorted = sortBlocks(blocks)
      const result = blocksToToml(sorted)

      expect(result).toBe(content)
    })
  })
})
