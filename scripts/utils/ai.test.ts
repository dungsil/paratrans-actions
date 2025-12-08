import { describe, it, expect } from 'vitest'
import { TranslationRefusedError } from './ai'

describe('AI 유틸리티', () => {
  describe('TranslationRefusedError', () => {
    it('오류 메시지를 올바르게 포맷해야 함', () => {
      const text = 'This is a test text that needs translation'
      const reason = 'SAFETY'
      
      const error = new TranslationRefusedError(text, reason)
      
      expect(error.name).toBe('TranslationRefusedError')
      expect(error.text).toBe(text)
      expect(error.reason).toBe(reason)
      expect(error.message).toContain('번역 거부')
      expect(error.message).toContain(reason)
    })

    it('긴 텍스트를 50자로 자르고 말줄임표를 추가해야 함', () => {
      const longText = 'a'.repeat(100)
      const reason = 'BLOCKLIST'
      
      const error = new TranslationRefusedError(longText, reason)
      
      expect(error.message).toContain('...')
      expect(error.message).toContain(longText.substring(0, 50))
      // 전체 긴 텍스트가 포함되지 않았는지 확인
      expect(error.message.length).toBeLessThan(longText.length + 50)
    })

    it('50자 이하 텍스트는 말줄임표 없이 전체를 표시해야 함', () => {
      const shortText = 'Short text'
      const reason = 'PROHIBITED_CONTENT'
      
      const error = new TranslationRefusedError(shortText, reason)
      
      expect(error.message).not.toContain('...')
      expect(error.message).toContain(shortText)
    })
  })
})
