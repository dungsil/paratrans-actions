import { describe, expect, it } from 'vitest'
import { shouldUseTransliteration } from './prompts'

describe('음역 마이그레이션', () => {
  it('파일명으로 음역 대상 여부를 올바르게 판단해야 함', () => {
    // 음역 대상 파일
    expect(shouldUseTransliteration('test_cultures_l_english.yml')).toBe(true)
    expect(shouldUseTransliteration('test_dynasty_names_l_english.yml')).toBe(true)
    expect(shouldUseTransliteration('character_names_l_english.yml')).toBe(true)
    expect(shouldUseTransliteration('culture_name_lists_l_english.yml')).toBe(true)
    
    // 음역 대상이 아닌 파일
    expect(shouldUseTransliteration('test_events_l_english.yml')).toBe(false)
    expect(shouldUseTransliteration('test_modifiers_l_english.yml')).toBe(false)
    expect(shouldUseTransliteration('test_decisions_l_english.yml')).toBe(false)
  })

  it('음역 키워드가 경로에 있으면 true를 반환함', () => {
    // 경로에 culture가 있으면 true
    expect(shouldUseTransliteration('culture/test_events_l_english.yml')).toBe(true)
    expect(shouldUseTransliteration('dynasties/test_modifiers_l_english.yml')).toBe(true)
  })

  it('음역 키워드가 다른 단어의 일부인 경우 false를 반환해야 함', () => {
    // 'cultural'은 'culture'가 아님
    expect(shouldUseTransliteration('test_cultural_events_l_english.yml')).toBe(false)
    // 'rename'은 'name'이 아님  
    expect(shouldUseTransliteration('test_rename_events_l_english.yml')).toBe(false)
  })
})
