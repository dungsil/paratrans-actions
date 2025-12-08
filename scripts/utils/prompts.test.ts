import { describe, it, expect } from 'vitest'
import { shouldUseTransliteration, getSystemPrompt, CK3_SYSTEM_PROMPT, CK3_TRANSLITERATION_PROMPT, STELLARIS_SYSTEM_PROMPT, STELLARIS_TRANSLITERATION_PROMPT, VIC3_SYSTEM_PROMPT, VIC3_TRANSLITERATION_PROMPT } from './prompts'

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

describe('getSystemPrompt', () => {
  describe('번역 모드 프롬프트', () => {
    it('CK3 게임에 대한 번역 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('ck3', false)
      expect(prompt).toBe(CK3_SYSTEM_PROMPT)
      expect(prompt).toContain('Crusader Kings III')
      expect(prompt).toContain('medieval')
    })

    it('Stellaris 게임에 대한 번역 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('stellaris', false)
      expect(prompt).toBe(STELLARIS_SYSTEM_PROMPT)
      expect(prompt).toContain('Stellaris')
      expect(prompt).toContain('sci-fi')
    })

    it('VIC3 게임에 대한 번역 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('vic3', false)
      expect(prompt).toBe(VIC3_SYSTEM_PROMPT)
      expect(prompt).toContain('Victoria 3')
      expect(prompt).toContain('industrial')
    })

    it('기본값(useTransliteration=false)으로 번역 프롬프트를 반환해야 함', () => {
      expect(getSystemPrompt('ck3')).toBe(CK3_SYSTEM_PROMPT)
      expect(getSystemPrompt('stellaris')).toBe(STELLARIS_SYSTEM_PROMPT)
      expect(getSystemPrompt('vic3')).toBe(VIC3_SYSTEM_PROMPT)
    })
  })

  describe('음역 모드 프롬프트', () => {
    it('CK3 게임에 대한 음역 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('ck3', true)
      expect(prompt).toBe(CK3_TRANSLITERATION_PROMPT)
      expect(prompt).toContain('transliterate')
      expect(prompt).toContain('phonetic')
    })

    it('Stellaris 게임에 대한 음역 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('stellaris', true)
      expect(prompt).toBe(STELLARIS_TRANSLITERATION_PROMPT)
      expect(prompt).toContain('transliterate')
      expect(prompt).toContain('phonetic')
    })

    it('VIC3 게임에 대한 음역 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('vic3', true)
      expect(prompt).toBe(VIC3_TRANSLITERATION_PROMPT)
      expect(prompt).toContain('transliterate')
      expect(prompt).toContain('phonetic')
    })
  })

  describe('음역 프롬프트 내용 검증', () => {
    it('CK3 음역 프롬프트에 예시가 포함되어 있어야 함', () => {
      const prompt = CK3_TRANSLITERATION_PROMPT
      expect(prompt).toContain('Afar')
      expect(prompt).toContain('아파르')
      expect(prompt).toContain('Anglo-Saxon')
      expect(prompt).toContain('앵글로색슨')
    })

    it('Stellaris 음역 프롬프트에 예시가 포함되어 있어야 함', () => {
      const prompt = STELLARIS_TRANSLITERATION_PROMPT
      expect(prompt).toContain('Zroni')
      expect(prompt).toContain('즈로니')
      expect(prompt).toContain('Vultaum')
      expect(prompt).toContain('불타움')
    })

    it('VIC3 음역 프롬프트에 예시가 포함되어 있어야 함', () => {
      const prompt = VIC3_TRANSLITERATION_PROMPT
      expect(prompt).toContain('Bismarck')
      expect(prompt).toContain('비스마르크')
      expect(prompt).toContain('Prussia')
      expect(prompt).toContain('프로이센')
    })
  })
})
