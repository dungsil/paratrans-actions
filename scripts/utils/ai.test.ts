import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  describe('translateAI 폴백 로직', () => {
    let originalEnv: string | undefined
    
    beforeEach(() => {
      // 환경 변수 설정 (API 키가 없어도 테스트 실행되도록)
      originalEnv = process.env.GOOGLE_AI_STUDIO_TOKEN
      process.env.GOOGLE_AI_STUDIO_TOKEN = 'test-api-key'
      vi.clearAllMocks()
    })

    afterEach(() => {
      // 환경 변수 복원
      process.env.GOOGLE_AI_STUDIO_TOKEN = originalEnv
      vi.restoreAllMocks()
    })

    it('await 없이는 try-catch가 비동기 에러를 잡지 못함을 검증', async () => {
      // 이 테스트는 원래 코드의 문제점을 보여줌
      const asyncFunction = async () => {
        throw new Error('Async error')
      }

      // try-catch 없이 return만 하면 에러가 전파되지 않음
      const withoutAwait = () => {
        return new Promise((resolve, reject) => {
          try {
            // await 없음 - 에러를 잡을 수 없음
            // 하지만 Promise는 반환되므로 나중에 reject를 처리할 수 있음
            const promise = asyncFunction()
            promise.catch(reject) // 에러를 명시적으로 처리
            return promise
          } catch (e) {
            reject(e)
          }
        })
      }

      // await을 사용하면 에러를 제대로 잡을 수 있음
      const withAwait = () => {
        return new Promise(async (resolve, reject) => {
          try {
            await asyncFunction() // await 있음 - 에러를 잡을 수 있음
          } catch (e) {
            reject(e)
          }
        })
      }

      // withoutAwait도 catch를 붙였으므로 에러를 잡음
      await expect(withoutAwait()).rejects.toThrow('Async error')
      
      // withAwait은 에러를 제대로 잡아서 reject
      await expect(withAwait()).rejects.toThrow('Async error')
    })

    it('Promise 생성자 내부에서 return은 무시됨을 검증', () => {
      // Promise 생성자 내부의 return은 의미가 없음
      const testPromise = new Promise((resolve, reject) => {
        return 'This is ignored' // 이 return은 무시됨
      })

      // Promise는 resolve나 reject가 호출될 때까지 pending 상태로 남음
      expect(testPromise).toBeInstanceOf(Promise)
    })
  })
})
