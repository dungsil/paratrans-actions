import { describe, it, expect } from 'vitest'
import { shouldUseTransliteration, shouldUseTransliterationForKey, isRegularTranslationContext, getSystemPrompt, CK3_SYSTEM_PROMPT, CK3_TRANSLITERATION_PROMPT, STELLARIS_SYSTEM_PROMPT, STELLARIS_TRANSLITERATION_PROMPT, VIC3_SYSTEM_PROMPT, VIC3_TRANSLITERATION_PROMPT } from './prompts'

describe('시스템 프롬프트', () => {
  describe('getSystemPrompt', () => {
    describe('번역 모드 (useTransliteration=false)', () => {
      it('CK3 게임 타입에 대해 CK3 프롬프트를 반환해야 함', () => {
        const prompt = getSystemPrompt('ck3', false)
        
        expect(prompt).toBe(CK3_SYSTEM_PROMPT)
      })

      it('Stellaris 게임 타입에 대해 Stellaris 프롬프트를 반환해야 함', () => {
        const prompt = getSystemPrompt('stellaris', false)
        
        expect(prompt).toBe(STELLARIS_SYSTEM_PROMPT)
      })

      it('VIC3 게임 타입에 대해 VIC3 프롬프트를 반환해야 함', () => {
        const prompt = getSystemPrompt('vic3', false)
        
        expect(prompt).toBe(VIC3_SYSTEM_PROMPT)
      })
    })

    describe('음역 모드 (useTransliteration=true)', () => {
      it('CK3 음역 모드에 대해 CK3 음역 프롬프트를 반환해야 함', () => {
        const prompt = getSystemPrompt('ck3', true)
        
        expect(prompt).toBe(CK3_TRANSLITERATION_PROMPT)
      })

      it('Stellaris 음역 모드에 대해 Stellaris 음역 프롬프트를 반환해야 함', () => {
        const prompt = getSystemPrompt('stellaris', true)
        
        expect(prompt).toBe(STELLARIS_TRANSLITERATION_PROMPT)
      })

      it('VIC3 음역 모드에 대해 VIC3 음역 프롬프트를 반환해야 함', () => {
        const prompt = getSystemPrompt('vic3', true)
        
        expect(prompt).toBe(VIC3_TRANSLITERATION_PROMPT)
      })
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

  describe('키 패턴에 따른 음역 모드 제외', () => {
    const transliterationFile = 'culture_l_english.yml'
    
    it('키가 제공되지 않으면 파일명만으로 판단해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile)).toBe(true)
    })

    it('일반 키는 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'culture_name_anglo_saxon')).toBe(true)
      expect(shouldUseTransliteration(transliterationFile, 'culture_name_bolghar')).toBe(true)
      expect(shouldUseTransliteration(transliterationFile, 'dynasty_test')).toBe(true)
    })

    it('_loc 패턴을 가진 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'culture_name_loc')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'some_text_loc')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'test_loc_key')).toBe(false)
    })

    it('_desc 패턴을 가진 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'culture_name_desc')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'some_culture_desc')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'test_desc')).toBe(false)
    })

    it('tradition_ 패턴을 가진 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'tradition_name')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'tradition_test')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'some_tradition_key')).toBe(false)
    })

    it('culture_parameter 패턴을 가진 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'culture_parameter_1')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'culture_parameter_test')).toBe(false)
    })

    it('_interaction 패턴을 가진 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'some_interaction')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'test_interaction_name')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'culture_interaction')).toBe(false)
    })

    it('대소문자 구분 없이 키 패턴을 감지해야 함', () => {
      expect(shouldUseTransliteration(transliterationFile, 'TEST_LOC')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'TEST_DESC')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'TRADITION_NAME')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'CULTURE_PARAMETER')).toBe(false)
      expect(shouldUseTransliteration(transliterationFile, 'TEST_INTERACTION')).toBe(false)
    })

    it('음역 대상이 아닌 파일에서는 키와 관계없이 false를 반환해야 함', () => {
      const nonTransliterationFile = 'events_l_english.yml'
      expect(shouldUseTransliteration(nonTransliterationFile, 'any_key')).toBe(false)
      expect(shouldUseTransliteration(nonTransliterationFile, 'test_desc')).toBe(false)
    })
  })
})

describe('isRegularTranslationContext', () => {
  it('decision으로 끝나는 키는 일반 번역 컨텍스트여야 함', () => {
    expect(isRegularTranslationContext('some_decision')).toBe(true)
    expect(isRegularTranslationContext('important_decision')).toBe(true)
    expect(isRegularTranslationContext('decision')).toBe(true)
  })

  it('desc로 끝나는 키는 일반 번역 컨텍스트여야 함', () => {
    expect(isRegularTranslationContext('heritage_desc')).toBe(true)
    expect(isRegularTranslationContext('culture_desc')).toBe(true)
    expect(isRegularTranslationContext('desc')).toBe(true)
  })

  it('event로 끝나는 키는 일반 번역 컨텍스트여야 함', () => {
    expect(isRegularTranslationContext('culture_event')).toBe(true)
    expect(isRegularTranslationContext('dynasty_event')).toBe(true)
    expect(isRegularTranslationContext('event')).toBe(true)
  })

  it('대소문자 구분 없이 작동해야 함', () => {
    expect(isRegularTranslationContext('SOME_DECISION')).toBe(true)
    expect(isRegularTranslationContext('Heritage_Desc')).toBe(true)
    expect(isRegularTranslationContext('CULTURE_EVENT')).toBe(true)
  })

  it('일반 키는 일반 번역 컨텍스트가 아니어야 함', () => {
    expect(isRegularTranslationContext('modifier')).toBe(false)
    expect(isRegularTranslationContext('dynasty_name')).toBe(false)
    expect(isRegularTranslationContext('culture_adj')).toBe(false)
    expect(isRegularTranslationContext('event_title')).toBe(false)
    expect(isRegularTranslationContext('decision_tooltip')).toBe(false)
  })
})

describe('shouldUseTransliterationForKey', () => {
  describe('음역 모드를 사용해야 하는 키 패턴', () => {
    it('_adj로 끝나는 키는 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliterationForKey('dyn_c_pingnan_guo_adj')).toBe(true)
      expect(shouldUseTransliterationForKey('dyn_c_kashgaria_adj')).toBe(true)
      expect(shouldUseTransliterationForKey('culture_adj')).toBe(true)
      expect(shouldUseTransliterationForKey('bpm_generic_revolt_communist_adj')).toBe(true)
    })

    it('_name으로 끝나는 키는 음역 모드를 사용해야 함', () => {
      expect(shouldUseTransliterationForKey('dynasty_name')).toBe(true)
      expect(shouldUseTransliterationForKey('culture_name')).toBe(true)
      expect(shouldUseTransliterationForKey('leader_name')).toBe(true)
      expect(shouldUseTransliterationForKey('character_name')).toBe(true)
    })

    it('대소문자 구분 없이 작동해야 함', () => {
      expect(shouldUseTransliterationForKey('DYNASTY_NAME')).toBe(true)
      expect(shouldUseTransliterationForKey('Culture_Adj')).toBe(true)
      expect(shouldUseTransliterationForKey('DYN_C_PINGNAN_GUO_ADJ')).toBe(true)
    })
  })

  describe('음역 모드를 사용하지 않아야 하는 키 패턴', () => {
    it('일반 번역 컨텍스트 키는 음역 모드를 사용하지 않아야 함', () => {
      // decision으로 끝나는 키
      expect(shouldUseTransliterationForKey('some_decision')).toBe(false)
      expect(shouldUseTransliterationForKey('important_decision')).toBe(false)
      
      // desc로 끝나는 키
      expect(shouldUseTransliterationForKey('heritage_desc')).toBe(false)
      expect(shouldUseTransliterationForKey('culture_desc')).toBe(false)
      
      // event로 끝나는 키
      expect(shouldUseTransliterationForKey('culture_event')).toBe(false)
      expect(shouldUseTransliterationForKey('dynasty_event')).toBe(false)
    })

    it('_adj나 _name으로 끝나지만 일반 번역 컨텍스트인 키는 제외해야 함', () => {
      // 실제로는 이런 키가 거의 없지만, 혹시 있다면 desc/event/decision이 우선
      expect(shouldUseTransliterationForKey('some_name_desc')).toBe(false)
      expect(shouldUseTransliterationForKey('culture_name_event')).toBe(false)
      expect(shouldUseTransliterationForKey('adj_decision')).toBe(false)
    })

    it('_adj나 _name으로 끝나지 않는 일반 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliterationForKey('modifier')).toBe(false)
      expect(shouldUseTransliterationForKey('event_title')).toBe(false)
      expect(shouldUseTransliterationForKey('tooltip')).toBe(false)
      expect(shouldUseTransliterationForKey('concept_authority')).toBe(false)
    })

    it('빈 문자열은 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliterationForKey('')).toBe(false)
    })

    it('_adj나 _name이 중간에 있는 키는 번역 모드를 사용해야 함', () => {
      expect(shouldUseTransliterationForKey('name_something_else')).toBe(false)
      expect(shouldUseTransliterationForKey('adj_value_modifier')).toBe(false)
      expect(shouldUseTransliterationForKey('culture_name_tooltip')).toBe(false)
    })
    
    it('음역 접미사와 제외 패턴이 모두 있는 키는 번역 모드를 사용해야 함 (제외 패턴 우선)', () => {
      // tradition_ 패턴이 있으면 _adj나 _name이 있어도 제외
      expect(shouldUseTransliterationForKey('tradition_adj')).toBe(false)
      expect(shouldUseTransliterationForKey('tradition_name')).toBe(false)
      
      // _loc 패턴이 있으면 _adj나 _name이 있어도 제외
      expect(shouldUseTransliterationForKey('some_loc_adj')).toBe(false)
      expect(shouldUseTransliterationForKey('text_loc_name')).toBe(false)
      
      // culture_parameter 패턴이 있으면 _adj나 _name이 있어도 제외
      expect(shouldUseTransliterationForKey('culture_parameter_name')).toBe(false)
      expect(shouldUseTransliterationForKey('culture_parameter_adj')).toBe(false)
      
      // _interaction 패턴이 있으면 _adj나 _name이 있어도 제외
      expect(shouldUseTransliterationForKey('some_interaction_name')).toBe(false)
      expect(shouldUseTransliterationForKey('custom_interaction_adj')).toBe(false)
    })
  })
})
