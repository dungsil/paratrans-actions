import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type GameType } from './types'
import { getTranslationMemories, getProperNouns } from './dictionary'

// Re-export GameType for backward compatibility
export type { GameType }

// 프로젝트 루트 디렉토리
const projectRoot = join(import.meta.dirname, '../..')

/**
 * Markdown 파일에서 프롬프트를 로드합니다.
 * @param filename 파일명 (prompts/ 디렉토리 기준 상대 경로)
 * @param gameType 게임 타입 (번역 메모리 치환용)
 * @returns 프롬프트 문자열
 */
function loadPromptFromFile(filename: string, gameType: GameType): string {
  const filePath = join(projectRoot, 'prompts', filename)
  try {
    let content = readFileSync(filePath, 'utf-8')
    
    // 템플릿 치환
    content = content.replace(/\{\{TRANSLATION_MEMORY\}\}/g, getTranslationMemories(gameType))
    content = content.replace(/\{\{PROPER_NOUNS_DICTIONARY\}\}/g, getProperNounsForPrompt(gameType))
    
    return content
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `프롬프트 파일이 존재하지 않습니다: ${filename}\n` +
        `예상 경로: ${filePath}\n` +
        `프롬프트 파일을 생성하거나 올바른 위치에 복사해 주세요.`
      )
    }
    throw new Error(`프롬프트 로드 실패: ${filename}: ${error.message}\n예상 경로: ${filePath}`)
  }
}

/**
 * 고유명사 사전을 음역 프롬프트용 포맷으로 변환합니다.
 * @param gameType 게임 타입
 * @returns 포맷팅된 고유명사 사전 문자열
 */
function getProperNounsForPrompt(gameType: GameType): string {
  const properNouns = getProperNouns(gameType)
  const entries = Object.entries(properNouns)
  
  if (entries.length === 0) {
    return '(No transliteration examples available for this game yet)'
  }
  
  return entries.map(([key, value]) => ` - "${key}" → "${value}"`).join('\n')
}

// 프롬프트 상수들 (외부 파일에서 로드)
// 참고: 프롬프트는 모듈 로드 시점에 즉시 로드되며 캐싱됩니다.
// - 프롬프트 파일이 누락되거나 오류가 있으면 애플리케이션 시작 시 실패합니다.
// - 프롬프트나 딕셔너리 변경사항은 애플리케이션 재시작 후 반영됩니다.
export const CK3_SYSTEM_PROMPT = loadPromptFromFile('ck3-translation.md', 'ck3')
export const STELLARIS_SYSTEM_PROMPT = loadPromptFromFile('stellaris-translation.md', 'stellaris')
export const VIC3_SYSTEM_PROMPT = loadPromptFromFile('vic3-translation.md', 'vic3')
export const CK3_TRANSLITERATION_PROMPT = loadPromptFromFile('ck3-transliteration.md', 'ck3')
export const STELLARIS_TRANSLITERATION_PROMPT = loadPromptFromFile('stellaris-transliteration.md', 'stellaris')
export const VIC3_TRANSLITERATION_PROMPT = loadPromptFromFile('vic3-transliteration.md', 'vic3')

export function getSystemPrompt(gameType: GameType, useTransliteration: boolean = false): string {
  if (useTransliteration) {
    switch (gameType) {
      case 'ck3':
        return CK3_TRANSLITERATION_PROMPT
      case 'stellaris':
        return STELLARIS_TRANSLITERATION_PROMPT
      case 'vic3':
        return VIC3_TRANSLITERATION_PROMPT
      default:
        throw new Error(`Unsupported game type: ${gameType}`)
    }
  }

  switch (gameType) {
    case 'ck3':
      return CK3_SYSTEM_PROMPT
    case 'stellaris':
      return STELLARIS_SYSTEM_PROMPT
    case 'vic3':
      return VIC3_SYSTEM_PROMPT
    default:
      throw new Error(`Unsupported game type: ${gameType}`)
  }
}

/**
 * 파일명과 키를 기반으로 음역 모드를 사용해야 하는지 판단합니다.
 * culture, dynasty, names 등의 키워드가 포함된 파일은 음역 모드를 사용합니다.
 * 단, 특정 패턴을 가진 키는 음역 대상에서 제외됩니다.
 * 
 * @param filename 검사할 파일명
 * @param key 검사할 키 (선택적). 제공되면 키 패턴도 함께 검사
 * @returns 음역 모드를 사용해야 하면 true
 */
export function shouldUseTransliteration(filename: string, key?: string): boolean {
  const lowerFilename = filename.toLowerCase()
  
  // 음역 대상 키워드 목록
  // - 'culture', 'cultures': 문화 이름 파일 (예: rice_cultures_l_english.yml)
  // - 'dynasty', 'dynasties': 왕조 이름 파일 (예: wap_dynasty_names_l_english.yml)
  // - 'names': 이름 파일 (예: RICE_sea_character_names_l_english.yml)
  // - 'character_name': 단수형 패턴 (예: character_name_list_l_english.yml)
  // - 'name_list': 이름 목록 파일 (예: culture_name_lists_l_english.yml)
  const transliterationKeywords = [
    'culture',
    'cultures',
    'dynasty',
    'dynasties',
    'names',
    'character_name',
    'name_list',
  ]
  
  // 파일명을 구분자(_,-, /)로 분할하여 세그먼트 확인
  const segments = lowerFilename.split(/[_\-\/]/)
  
  // 각 키워드에 대해:
  // 1. 단일 단어 키워드(culture, cultures, dynasty, dynasties, names)는 세그먼트와 정확히 일치해야 함
  // 2. 복합 키워드(character_name, name_list)는 원본 파일명에 포함되어 있으면 매치
  const filenameMatchesTransliteration = transliterationKeywords.some(keyword => {
    if (keyword.includes('_')) {
      // 복합 키워드는 원본 파일명에 포함되어 있는지 확인
      return lowerFilename.includes(keyword)
    } else {
      // 단일 키워드는 세그먼트와 정확히 일치하는지 확인 (false positive 방지)
      return segments.includes(keyword)
    }
  })
  
  // 파일명이 음역 대상이 아니면 false 반환
  if (!filenameMatchesTransliteration) {
    return false
  }
  
  // 키가 제공되지 않으면 파일명만으로 판단
  if (!key) {
    return true
  }
  
  // 키에 다음 패턴이 포함되면 음역 모드를 사용하지 않음 (일반 번역 사용)
  // - '_loc': 현지화된 설명 텍스트
  // - '_desc': 설명(description) 텍스트  
  // - 'tradition_': 전통(tradition) 관련 텍스트
  // - 'culture_parameter': 문화 파라미터 텍스트
  // - '_interaction': 상호작용 텍스트
  const translationOnlyPatterns = [
    '_loc',
    '_desc',
    'tradition_',
    'culture_parameter',
    '_interaction',
  ]
  
  const lowerKey = key.toLowerCase()
  const shouldSkipTransliteration = translationOnlyPatterns.some(pattern => 
    lowerKey.includes(pattern)
  )
  
  // 제외 패턴에 해당하면 음역 모드 사용 안 함
  return !shouldSkipTransliteration
}
