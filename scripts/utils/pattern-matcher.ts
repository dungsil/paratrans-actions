/**
 * 와일드카드 패턴을 정규표현식으로 변환하여 매칭합니다.
 * @param pattern 와일드카드 패턴 (예: "*_special_*")
 * @param text 매칭할 텍스트
 * @param caseInsensitive 대소문자 구분 여부 (기본값: true)
 * @returns 매칭 여부
 */
export function matchWildcardPattern(pattern: string, text: string, caseInsensitive: boolean = true): boolean {
  const processedPattern = caseInsensitive ? pattern.toLowerCase() : pattern
  const processedText = caseInsensitive ? text.toLowerCase() : text
  
  // 와일드카드 패턴 지원 (간단한 glob 패턴: * 를 .* 로 변환)
  // 먼저 * 를 임시 플레이스홀더로 변환, 특수 문자 이스케이프 후, 플레이스홀더를 .* 로 변환
  const regexPattern = processedPattern
    .replace(/\*/g, '__WILDCARD_PLACEHOLDER__') // * 를 임시 플레이스홀더로
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 특수 문자 이스케이프
    .replace(/__WILDCARD_PLACEHOLDER__/g, '.*') // 플레이스홀더를 .* 로 변환
  
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(processedText)
}
