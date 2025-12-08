import { describe, it, expect } from 'vitest'
import { hashing } from './hashing'

describe('해싱', () => {
  it('동일한 입력에 대해 일관된 해시를 생성해야 함', () => {
    const input = 'test string'
    const hash1 = hashing(input)
    const hash2 = hashing(input)
    
    expect(hash1).toBe(hash2)
  })

  it('다른 입력에 대해 다른 해시를 생성해야 함', () => {
    const hash1 = hashing('test string 1')
    const hash2 = hashing('test string 2')
    
    expect(hash1).not.toBe(hash2)
  })
})
