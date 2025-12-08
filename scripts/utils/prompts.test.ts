import { describe, it, expect } from 'vitest'
import { shouldUseTransliteration, getSystemPrompt, CK3_SYSTEM_PROMPT, CK3_TRANSLITERATION_PROMPT, STELLARIS_SYSTEM_PROMPT, STELLARIS_TRANSLITERATION_PROMPT, VIC3_SYSTEM_PROMPT, VIC3_TRANSLITERATION_PROMPT } from './prompts'

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

describe('shouldUseTransliteration', () => {
  describe('음역 모드를 사용해야 하는 파일명 패턴', () => {
    it('culture 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('00_culture_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('rice_cultures_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('culture_gfx_l_english.yml')).toBe(true)
    })

    it('cultures 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('cultures_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('FCH_cultures_l_english.yml')).toBe(true)
    })

    it('dynasty 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('wap_dynasty_names_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('dynasty_l_english.yml')).toBe(true)
    })

    it('dynasties 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('dynasties_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('more_dynasties_l_english.yml')).toBe(true)
    })

    it('names 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('RICE_sea_character_names_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('leader_names_l_english.yml')).toBe(true)
    })

    it('character_name 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('character_names_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('character_name_list_l_english.yml')).toBe(true)
    })

    it('name_list 키워드가 포함된 파일명은 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('culture_name_lists_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('name_lists_l_english.yml')).toBe(true)
    })

    it('대소문자 구분 없이 작동해야 함', () => {
      expect(shouldUseTransliteration('CULTURE_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('Dynasty_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('NAMES_l_english.yml')).toBe(true)
    })

    it('경로가 포함된 파일명도 올바르게 감지해야 함', () => {
      expect(shouldUseTransliteration('culture/culture_name_lists_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('dynasties/dynasty_names_l_english.yml')).toBe(true)
      expect(shouldUseTransliteration('names/character_names_l_english.yml')).toBe(true)
    })
  })

  describe('음역 모드를 사용하지 않아야 하는 파일명 패턴', () => {
    it('키워드가 없는 일반 파일명은 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('events_l_english.yml')).toBe(false)
      expect(shouldUseTransliteration('modifiers_l_english.yml')).toBe(false)
      expect(shouldUseTransliteration('decisions_l_english.yml')).toBe(false)
    })

    it('유사하지만 다른 키워드를 포함한 파일명은 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('cultural_traditions_l_english.yml')).toBe(false)
      expect(shouldUseTransliteration('cultural_acceptance_l_english.yml')).toBe(false)
      expect(shouldUseTransliteration('cultural_parameters_l_english.yml')).toBe(false)
    })

    it('빈 문자열은 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration('')).toBe(false)
    })
  })
})
