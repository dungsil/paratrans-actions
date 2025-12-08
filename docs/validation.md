# 검증 시스템

## 개요

번역 검증 시스템은 AI가 생성한 번역의 품질을 자동으로 확인하여 게임에서 발생할 수 있는 문제를 사전에 방지합니다.

**모듈 위치:** `scripts/utils/translation-validator.ts`

## 검증 규칙

### 1. 불필요한 LLM 응답 필터링

AI 모델이 번역 외에 메타 응답을 포함하는 경우를 감지합니다.

**문제 사례:**

```
원본: "The Duke arrives"

잘못된 번역:
"네, 알겠습니다. 공작이 도착합니다"
"Yes, I will translate: 공작이 도착합니다"
"Okay, here is the translation: 공작이 도착합니다"

올바른 번역:
"공작이 도착합니다"
```

**감지 패턴:**

```typescript
const unwantedResponses = [
  // 한글
  /네,?\s*(알겠습니다|이해했습니다|번역하겠습니다)/i,
  /^(네|알겠습니다|이해했습니다)[,.]?\s*/i,
  
  // 영어
  /yes,?\s*(i understand|understood|i will translate)/i,
  /okay,?\s*(i will translate|here is|here's)/i,
  /^(yes|okay|sure)[,.]?\s*/i,
  
  // 번역 관련 메타 표현
  /번역:?\s*/i,
  /translation:?\s*/i,
  /here is( the)? translation:?\s*/i
]
```

**검증 로직:**

```typescript
for (const pattern of unwantedResponses) {
  if (pattern.test(translatedText)) {
    return {
      isValid: false,
      reason: '불필요한 LLM 응답 포함'
    }
  }
}
```

### 2. 기술 식별자 보존

`snake_case` 형태의 기술 식별자는 번역하지 않아야 합니다.

**문제 사례:**

```
원본: "mod_icon_special"
잘못된 번역: "모드_아이콘_특별"
올바른 번역: "mod_icon_special"

원본: "event_type_character_event"
잘못된 번역: "이벤트_유형_캐릭터_이벤트"
올바른 번역: "event_type_character_event"
```

**검증 로직:**

```typescript
// 소스가 순수 snake_case인지 확인
const isSourceTechnical = /^[a-z_]+$/.test(sourceText)

if (isSourceTechnical) {
  // 번역도 동일한 형태를 유지해야 함
  if (!/^[a-z_]+$/.test(translatedText)) {
    return {
      isValid: false,
      reason: '기술 식별자가 번역됨'
    }
  }
}
```

**예외:**

- 설명 텍스트가 포함된 경우는 번역 가능
- 예: `"mod_icon: Special Icon"` → `"mod_icon: 특별 아이콘"`

### 3. 게임 변수 보존

게임에서 사용하는 변수는 정확히 보존되어야 합니다.

**변수 유형:**

#### Dollar Sign 변수 (`$variable$`)

```
예: $k_france$, $c_paris$, $b_orleans$

원본: "Welcome to $k_france$"
올바른 번역: "$k_france$에 오신 것을 환영합니다"
잘못된 번역: "프랑스 왕국에 오신 것을 환영합니다" (변수 누락)
```

#### Square Bracket 변수 (`[Function]`)

```
예: [GetTitle], [GetName], [This.GetCulture]

원본: "The [GetTitle] is powerful"
올바른 번역: "[GetTitle]은(는) 강력합니다"
잘못된 번역: "제목은 강력합니다" (변수 누락)
```

#### Scoped 변수 (`[Scope.Function|Decorator]`)

```
예: [region|E], [character.Custom('KEY')], [Select_CString(...)]

원본: "From [region|E]"
올바른 번역: "[region|E]에서"
잘못된 번역: "지역에서" (변수 누락)
```

#### At Sign 변수 (`@icon!`)

```
예: @warning!, @gold!, @prestige!

원본: "Cost: @gold! 100"
올바른 번역: "비용: @gold! 100"
```

#### Pound Sign 변수 (`£currency£`)

```
예: £gold£, £prestige£, £piety£

원본: "Gain £gold£100"
올바른 번역: "£gold£100 획득"
```

#### Hash 마크업 (`#formatting#`)

```
예: #bold#, #weak#, #high#, #low#

원본: "#bold This is important#!"
올바른 번역: "#bold 이것은 중요합니다#!"
```

**검증 로직:**

```typescript
// 1. 소스에서 모든 변수 추출
const sourceVariables = extractAllGameVariables(sourceText)

// 2. 번역에서 모든 변수 추출
const translationVariables = extractAllGameVariables(translatedText)

// 3. 소스의 각 고유 변수가 번역에 존재하는지 확인
const uniqueSourceVars = [...new Set(sourceVariables)]
const uniqueTransVars = [...new Set(translationVariables)]

for (const sourceVar of uniqueSourceVars) {
  const found = uniqueTransVars.some(transVar => 
    normalizeGameVariableStructure(transVar) === 
    normalizeGameVariableStructure(sourceVar)
  )
  
  if (!found) {
    return {
      isValid: false,
      reason: `누락된 게임 변수: ${sourceVar}`
    }
  }
}
```

**구조 정규화:**

문자열 리터럴은 번역 가능하므로 구조만 비교합니다.

```typescript
function normalizeGameVariableStructure(variable: string): string {
  // 문자열 리터럴을 플레이스홀더로 치환
  return variable.replace(/(['"])((?:\\.|(?!\1)[^\\])*?)\1/g, "'__STRING__'")
}

// 예시
normalizeGameVariableStructure("[Concatenate(' or ', GetName)]")
// → "[Concatenate('__STRING__', GetName)]"

normalizeGameVariableStructure("[Concatenate(' 혹은 ', GetName)]")
// → "[Concatenate('__STRING__', GetName)]"

// 두 구조가 동일하므로 번역 유효
```

### 4. 변수 내부 한글 금지

변수 내부에 한글이 포함되면 게임에서 작동하지 않습니다.

**문제 사례:**

```
원본: "[GetTitle]"
잘못된 번역: "[Get제목]"
잘못된 번역: "[얻기Title]"
잘못된 번역: "[제목가져오기]"
올바른 번역: "[GetTitle]"

원본: "$k_france$"
잘못된 번역: "$k_프랑스$"
올바른 번역: "$k_france$"
```

**검증 로직:**

```typescript
// 한글 감지 정규식
const koreanRegex = /[가-힣ㄱ-ㅎㅏ-ㅣ]/

for (const variable of translationVariables) {
  if (koreanRegex.test(variable)) {
    return {
      isValid: false,
      reason: `변수 내부 한글 포함: ${variable}`
    }
  }
}
```

### 5. 잘못된 변수 구문 감지

AI가 서로 다른 변수 구문을 혼합하여 생성하는 버그를 방지합니다.

**문제 패턴:**

#### Dollar Sign 혼합

```
✗ $[culture|E]      # dollar + bracket
✗ $<GetTitle>       # dollar + angle bracket
✗ $ variable $      # 공백 포함

✓ $culture$         # 올바른 형태
✓ [culture|E]       # 올바른 형태
```

#### Pound Sign 혼합

```
✗ £[variable]£      # pound + bracket
✗ £<icon>           # pound + angle bracket

✓ £gold£           # 올바른 형태
✓ [variable]       # 올바른 형태
```

#### At Sign 혼합

```
✗ @[icon]@         # at + bracket
✗ @<warning>       # at + angle bracket

✓ @warning!        # 올바른 형태
✓ [icon]           # 올바른 형태
```

#### Bracket 내부 혼합

```
✗ [$variable]      # bracket 내부에 dollar
✗ [£currency]      # bracket 내부에 pound
✗ [@icon]          # bracket 내부에 at

✓ [GetVariable]    # 올바른 형태
✓ $variable$       # 올바른 형태
```

**검증 로직:**

```typescript
const malformedPatterns = [
  /\$\[/g,           // $[
  /\$</g,            // $<
  /\$\s+\w+\s+\$/g,  // $ var $
  /£\[/g,            // £[
  /£</g,             // £<
  /@\[/g,            // @[
  /@</g,             // @<
  /\[\$/g,           // [$
  /\[£/g,            // [£
  /\[@/g             // [@
]

const malformed: string[] = []

for (const pattern of malformedPatterns) {
  const matches = translatedText.match(pattern)
  if (matches) {
    malformed.push(...matches)
  }
}

if (malformed.length > 0) {
  return {
    isValid: false,
    reason: `잘못된 변수 구문: ${malformed.join(', ')}`
  }
}
```

**검증 로직 개선 (2025-11 ~ 2025-12):**

```typescript
// 문자열 리터럴 내부의 달러 변수는 무시
const STRING_LITERAL_REGEX = /'(?:[^'\\]|\\.)*'/g

function isInsideStringLiteral(text: string, index: number): boolean {
  STRING_LITERAL_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  
  while ((match = STRING_LITERAL_REGEX.exec(text)) !== null) {
    if (match.index < index && index < match.index + match[0].length) {
      return true
    }
  }
  return false
}

// 패턴 감지 시 문자열 리터럴 내부 제외
const malformed: string[] = []
for (const pattern of malformedPatterns) {
  let match: RegExpExecArray | null
  while ((match = pattern.exec(translatedText)) !== null) {
    if (!isInsideStringLiteral(translatedText, match.index)) {
      malformed.push(match[0])
    }
  }
}
```

**개선 사항:**
- Concept 변수 내 문자열 리터럴 (`'$variable$'`) 허용
- `[Concatenate('$gold$', other)]` 같은 패턴을 False Positive로 감지하던 문제 해결
- 208개 이상의 테스트 케이스로 검증
- **섹션 기호 색상 코드 지원**: `§Y$variable$`, `§H£energy£`, `§BA£variable£` 패턴을 올바른 변수로 인식합니다.
- **변수만으로 구성된 텍스트 감지**: AI가 게임 변수만 있는 텍스트를 수정하는 것을 방지합니다.

**문자열 리터럴 예제:**

```
✓ [Concatenate('$gold$', GetName)]     # 리터럴 내부 달러 변수 허용
✓ [Concept('title', 'The $title$')]    # Concept 내 허용
✗ Text $[invalid]                       # 리터럴 밖 잘못된 패턴
```

**섹션 기호 색상 코드 예제:**

```
✓ §Y$variable$                         # 단일 문자 색상 코드 + 달러 변수
✓ §G$@shroud_seal_decrease|0%$§!       # 색상 코드 + @ 포함 변수
✓ §H£energy£                           # 색상 코드 + 파운드 변수
✓ §BA£variable£                        # 다중 문자 색상 코드 + 파운드 변수
```

### 6. 대괄호 불균형 감지

AI가 게임 변수의 닫는 `]`를 제거하거나 추가하는 오류를 감지합니다.

**문제 사례:**

```
원본: "The [GetTitle] is strong"
잘못된 번역: "[GetTitle은(는) 강력합니다"  # ] 누락
잘못된 번역: "[GetTitle]]은(는) 강력합니다"  # ] 추가
올바른 번역: "[GetTitle]은(는) 강력합니다"
```

**검증 로직:**

```typescript
let openBrackets = 0
let closeBrackets = 0
for (let i = 0; i < translatedText.length; i++) {
  if (translatedText[i] === '[') openBrackets++
  else if (translatedText[i] === ']') closeBrackets++
}

if (openBrackets !== closeBrackets) {
  return {
    isValid: false,
    reason: `대괄호 불균형: [ 개수(${openBrackets})와 ] 개수(${closeBrackets})가 일치하지 않음`
  }
}
```

## 검증 함수 API

### `validateTranslation(sourceText, translatedText, gameType)`

단일 번역을 검증합니다.

**매개변수:**
- `sourceText: string` - 원본 텍스트
- `translatedText: string` - 번역된 텍스트
- `gameType: GameType` - 게임 타입

**반환값:**
```typescript
interface ValidationResult {
  isValid: boolean
  reason?: string
}
```

**사용 예:**

```typescript
const result = validateTranslation(
  'The [GetTitle] is strong',
  '[GetTitle]은(는) 강력합니다',
  'ck3'
)

if (!result.isValid) {
  console.error('검증 실패:', result.reason)
}
```

### `validateTranslationEntries(sourceEntries, translationEntries, gameType)`

파일 전체를 검증합니다.

**매개변수:**
- `sourceEntries: Record<string, [string, string]>` - 소스 항목들
- `translationEntries: Record<string, [string, string]>` - 번역 항목들
- `gameType: GameType` - 게임 타입

**반환값:**

```typescript
Array<{
  key: string
  sourceValue: string
  translatedValue: string
  reason: string
}>
```

**사용 예:**

```typescript
const invalidItems = validateTranslationEntries(
  sourceYaml['l_english'],
  targetYaml['l_korean'],
  'ck3'
)

for (const item of invalidItems) {
  console.log(`${item.key}: ${item.reason}`)
  // 예: "event_title: 누락된 게임 변수: [GetTitle]"
}
```

## 재번역 시스템

검증에 실패한 번역을 자동으로 무효화하여 재번역을 트리거합니다.

**모듈 위치:** `scripts/utils/retranslation-invalidator.ts`

### 동작 과정

1. **파일 스캔**
   ```typescript
   // 모든 번역 파일 탐색
   const targetDir = 'ck3/RICE/mod/localization/korean/'
   const files = await readdir(targetDir, { recursive: true })
   ```

2. **각 항목 검증**
   ```typescript
   for (const [key, [translated, hash]] of Object.entries(targetYaml['l_korean'])) {
     const source = sourceYaml['l_english'][key]
     
     const result = validateTranslation(source[0], translated, gameType)
     
     if (!result.isValid) {
       invalidItems.push({ key, reason: result.reason })
     }
   }
   ```

3. **캐시 무효화**
   ```typescript
   for (const item of invalidItems) {
     const hash = sourceYaml['l_english'][item.key][1]
     await removeCache(hash, gameType)
     
     // 해시를 null로 설정하여 재번역 트리거
     targetYaml['l_korean'][item.key][1] = null
   }
   ```

4. **파일 업데이트**
   ```typescript
   await writeFile(targetPath, stringifyYaml(targetYaml), 'utf-8')
   ```

### 사용 방법

```bash
# CK3 재번역
pnpm ck3:retranslate

# VIC3 재번역
pnpm vic3:retranslate

# Stellaris 재번역
pnpm stellaris:retranslate
```

**출력 예:**

```
[RICE] 검증 시작
[RICE/events.yml:event_1] 검증 실패: 누락된 게임 변수: [GetTitle]
[RICE/events.yml:event_2] 검증 실패: 변수 내부 한글 포함: [Get제목]
[RICE/characters.yml:char_1] 검증 실패: 기술 식별자가 번역됨
[RICE] 총 3개 항목 무효화됨

다음 번역 실행 시 재번역됩니다.
```

## 검증 우회

특정 경우에는 검증을 우회해야 할 수 있습니다.

### 의도적인 변수 생략

```typescript
// 원본: "The [GetTitle]"
// 번역: "그" (맥락상 제목을 생략)

// 이 경우 수동으로 사전에 추가
const ck3Dictionaries = {
  'The [GetTitle]': '그'
}
```

### 특수 마크업

```typescript
// 원본: "#bold Important#!"
// 번역 시 한글 마크업으로 변환
const translated = response.text()
  .replaceAll(/#약(하게|화된|[화한])/g, '#weak')
  .replaceAll(/#강조/g, '#bold')
```

## 검증 통계

### 검증 성공률

```typescript
async function getValidationStats() {
  const total = totalTranslations
  const invalid = invalidItems.length
  const valid = total - invalid
  
  console.log(`검증 성공률: ${(valid / total * 100).toFixed(2)}%`)
  console.log(`총 ${total}개 중 ${valid}개 유효, ${invalid}개 무효`)
}
```

**목표 성공률:** 99%+

### 일반적인 실패 이유 분포

```
1. 변수 누락: 45%
2. 변수 내부 한글: 30%
3. 불필요한 응답: 15%
4. 잘못된 구문: 7%
5. 기술 식별자 번역: 3%
```

## 검증 개선

### 새 규칙 추가

```typescript
// scripts/utils/translation-validator.ts

export function validateTranslation(...) {
  // 기존 검증...
  
  // 새 규칙: 괄호 균형 검사
  const sourceParens = (sourceText.match(/\(/g) || []).length
  const targetParens = (translatedText.match(/\(/g) || []).length
  
  if (sourceParens !== targetParens) {
    return {
      isValid: false,
      reason: '괄호 개수 불일치'
    }
  }
  
  return { isValid: true }
}
```

### 게임별 규칙

```typescript
export function validateTranslation(source, target, gameType) {
  // 공통 검증...
  
  // 게임별 추가 검증
  switch (gameType) {
    case 'ck3':
      return validateCK3Specific(source, target)
    case 'stellaris':
      return validateStellarisSpecific(source, target)
    case 'vic3':
      return validateVIC3Specific(source, target)
  }
}
```

## 모범 사례

### 1. 정기적인 검증

```bash
# 주간 검증 스크립트
#!/bin/bash
pnpm ck3:retranslate
pnpm vic3:retranslate
pnpm stellaris:retranslate

# 무효화된 항목이 있으면 재번역
pnpm ck3
pnpm vic3
pnpm stellaris
```

### 2. 검증 로그 모니터링

```typescript
log.info(`검증 완료: ${validCount}개 유효, ${invalidCount}개 무효`)

if (invalidCount > totalCount * 0.05) {
  log.warn('검증 실패율이 5%를 초과했습니다!')
}
```

### 3. 사전 활용

자주 실패하는 패턴은 사전에 추가하여 검증 오류를 예방합니다.

```typescript
const ck3Dictionaries = {
  // 변수가 포함된 복잡한 텍스트
  'The [GetTitle] of [GetName]': '[GetName]의 [GetTitle]',
  
  // 특수 구문
  '@warning! Important': '@warning! 중요',
}
```

## 다음 단계

- [사전 관리](dictionary.md) - 번역 사전 시스템
- [API 레퍼런스](api-reference.md) - 검증 함수 상세
- [트러블슈팅](troubleshooting.md) - 검증 문제 해결

---

**참고:** 검증 시스템은 지속적으로 개선되고 있습니다. 새로운 오류 패턴을 발견하면 이슈로 제보해주세요.
