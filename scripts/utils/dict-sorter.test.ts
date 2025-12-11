import { describe, it, expect } from 'vitest'
import { 
  parseTomlWithComments, 
  normalizeKeyForSorting, 
  sortBlocks, 
  blocksToToml,
  type CommentBlock
} from './dict-sorter'

describe('dict-sorter', () => {
  describe('parseTomlWithComments', () => {
    it('주석 블록으로 그룹화할 수 있어야 함', () => {
      const content = `# 주석 1
"key1" = "value1"
"key2" = "value2"

# 주석 2
"key3" = "value3"`

      const blocks = parseTomlWithComments(content)
      
      expect(blocks).toHaveLength(2)
      expect(blocks[0].comments).toEqual(['# 주석 1'])
      expect(blocks[0].entries).toHaveLength(2)
      expect(blocks[1].comments).toEqual(['# 주석 2'])
      expect(blocks[1].entries).toHaveLength(1)
    })

    it('인라인 주석을 보존해야 함', () => {
      const content = `"key" = "value" # 인라인 주석`

      const blocks = parseTomlWithComments(content)
      
      expect(blocks[0].entries[0].inlineComment).toBe('# 인라인 주석')
    })

    it('빈 줄로 블록을 구분해야 함', () => {
      const content = `"key1" = "value1"

"key2" = "value2"`

      const blocks = parseTomlWithComments(content)
      
      expect(blocks).toHaveLength(2)
    })

    it('따옴표 없는 키도 파싱해야 함', () => {
      const content = `key = "value"`

      const blocks = parseTomlWithComments(content)
      
      expect(blocks[0].entries[0].key).toBe('key')
      expect(blocks[0].entries[0].value).toBe('"value"')
    })
  })

  describe('normalizeKeyForSorting', () => {
    it('따옴표를 제거해야 함', () => {
      expect(normalizeKeyForSorting('"key"')).toBe('key')
      expect(normalizeKeyForSorting('key')).toBe('key')
    })

    it('소문자로 변환해야 함', () => {
      expect(normalizeKeyForSorting('"KEY"')).toBe('key')
      expect(normalizeKeyForSorting('"Key"')).toBe('key')
    })
  })

  describe('sortBlocks', () => {
    it('엔트리를 알파벳 순으로 정렬해야 함', () => {
      const blocks: CommentBlock[] = [{
        comments: ['# 테스트'],
        entries: [
          { key: '"c"', value: '"3"' },
          { key: '"a"', value: '"1"' },
          { key: '"b"', value: '"2"' }
        ]
      }]

      const sorted = sortBlocks(blocks)
      
      expect(sorted[0].entries[0].key).toBe('"a"')
      expect(sorted[0].entries[1].key).toBe('"b"')
      expect(sorted[0].entries[2].key).toBe('"c"')
    })

    it('대소문자를 구분하지 않고 정렬해야 함', () => {
      const blocks: CommentBlock[] = [{
        comments: [],
        entries: [
          { key: '"Z"', value: '"1"' },
          { key: '"a"', value: '"2"' },
          { key: '"B"', value: '"3"' }
        ]
      }]

      const sorted = sortBlocks(blocks)
      
      expect(sorted[0].entries[0].key).toBe('"a"')
      expect(sorted[0].entries[1].key).toBe('"B"')
      expect(sorted[0].entries[2].key).toBe('"Z"')
    })

    it('각 블록을 독립적으로 정렬해야 함', () => {
      const blocks: CommentBlock[] = [
        {
          comments: ['# 블록 1'],
          entries: [
            { key: '"c"', value: '"3"' },
            { key: '"a"', value: '"1"' }
          ]
        },
        {
          comments: ['# 블록 2'],
          entries: [
            { key: '"z"', value: '"26"' },
            { key: '"x"', value: '"24"' }
          ]
        }
      ]

      const sorted = sortBlocks(blocks)
      
      expect(sorted[0].entries[0].key).toBe('"a"')
      expect(sorted[0].entries[1].key).toBe('"c"')
      expect(sorted[1].entries[0].key).toBe('"x"')
      expect(sorted[1].entries[1].key).toBe('"z"')
    })
  })

  describe('blocksToToml', () => {
    it('블록을 TOML 형식으로 변환해야 함', () => {
      const blocks: CommentBlock[] = [{
        comments: ['# 주석'],
        entries: [
          { key: '"key1"', value: '"value1"' },
          { key: '"key2"', value: '"value2"' }
        ]
      }]

      const toml = blocksToToml(blocks)
      
      expect(toml).toBe('# 주석\n"key1" = "value1"\n"key2" = "value2"\n')
    })

    it('인라인 주석을 보존해야 함', () => {
      const blocks: CommentBlock[] = [{
        comments: [],
        entries: [
          { key: '"key"', value: '"value"', inlineComment: '# 인라인' }
        ]
      }]

      const toml = blocksToToml(blocks)
      
      expect(toml).toContain('# 인라인')
    })

    it('블록 사이에 빈 줄을 추가해야 함', () => {
      const blocks: CommentBlock[] = [
        {
          comments: ['# 블록 1'],
          entries: [{ key: '"key1"', value: '"value1"' }]
        },
        {
          comments: ['# 블록 2'],
          entries: [{ key: '"key2"', value: '"value2"' }]
        }
      ]

      const toml = blocksToToml(blocks)
      
      expect(toml).toContain('\n\n# 블록 2')
    })
  })

  describe('전체 통합 테스트', () => {
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
  })
})
