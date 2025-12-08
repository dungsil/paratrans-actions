import { describe, it, expect } from 'vitest'
import { getSystemPrompt, CK3_SYSTEM_PROMPT, STELLARIS_SYSTEM_PROMPT, VIC3_SYSTEM_PROMPT } from './prompts'

describe('시스템 프롬프트', () => {
  describe('getSystemPrompt', () => {
    it('CK3 게임 타입에 대해 CK3 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('ck3')
      
      expect(prompt).toBe(CK3_SYSTEM_PROMPT)
    })

    it('Stellaris 게임 타입에 대해 Stellaris 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('stellaris')
      
      expect(prompt).toBe(STELLARIS_SYSTEM_PROMPT)
    })

    it('VIC3 게임 타입에 대해 VIC3 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('vic3')
      
      expect(prompt).toBe(VIC3_SYSTEM_PROMPT)
    })

    it('지원하지 않는 게임 타입에 대해 오류를 발생시켜야 함', () => {
      expect(() => getSystemPrompt('invalid' as any)).toThrow('Unsupported game type: invalid')
    })
  })
})
