# 사전 관리

## 개요

번역 사전은 자주 사용되는 용어의 번역을 수동으로 정의하여 일관성을 유지하고 AI 번역 비용을 절감합니다.

**모듈 위치:** `scripts/utils/dictionary.ts`

## 사전의 역할

### 1. 용어 일관성

동일한 용어가 항상 동일하게 번역됩니다.

```typescript
// 사전 없이
"duke" → "공작" (1차 번역)
"duke" → "공작 작위" (2차 번역, 불일치!)

// 사전 사용
"duke" → "공작" (항상 일관성 유지)
```

### 2. 즉시 번역

AI 호출 없이 즉시 번역을 제공합니다.

```typescript
// 사전 사용
응답 시간: ~1ms
비용: $0

// AI 번역
응답 시간: ~500ms
비용: $0.0001 per call
```

### 3. AI 번역 가이드

사전 내용이 AI 프롬프트의 "번역 메모리"로 포함됩니다.

```
System Prompt:
...
Translation Memory:
- "duke" → "공작"
- "stewardship" → "관리력"
...

Now translate: "The duke improves his stewardship"
```

## 사전 구조

### CK3 사전 분리 구조

CK3 사전은 용어집(Glossary)과 고유명사(Proper Nouns)로 분리되어 있습니다:

```typescript
// CK3 용어집 - 번역 메모리로 LLM에 전달됨
const ck3Glossary: Record<string, string> = {
  'duke': '공작',
  'stewardship': '관리력',
  'high king': '고왕',
  // 게임 용어, 일반 표현 등
}

// CK3 고유명사 - 직접 매칭에만 사용됨 (LLM 컨텍스트 최적화)
const ck3ProperNouns: Record<string, string> = {
  'elephantine': '엘레판티네',
  'karakoram': '카라코람',
  'imhotep': '임호테프',
  // 지명, 인명, 가문명 등
}
```

**장점:**
- LLM 컨텍스트 창 최적화 (고유명사는 번역 메모리에서 제외)
- 용어 유형별 관리 용이
- 번역 일관성 향상

### 게임별 사전

```typescript
// Stellaris 전용 사전
const stellarisDictionaries: Record<string, string> = {
  'empire': '제국',
  'unity': '통합',
  // ...
}

// VIC3 전용 사전
const vic3Dictionaries: Record<string, string> = {
  'authority': '권위',
  'legitimacy': '정통성',
  // ...
}
```

### 통합 인터페이스

```typescript
export function getDictionaries(gameType: GameType): Record<string, string> {
  switch (gameType) {
    case 'ck3':
      return { ...ck3Glossary, ...ck3ProperNouns }
    case 'stellaris':
      return stellarisDictionaries
    case 'vic3':
      return vic3Dictionaries
    default:
      throw new Error(`Unsupported game type: ${gameType}`)
  }
}

// 번역 메모리 (LLM 프롬프트용) - 일반 용어만 포함, 고유명사 제외
export function getTranslationMemories(gameType: GameType = 'ck3'): string {
  const glossary = getGlossary(gameType)
  return Object.keys(glossary)
    .map(key => ` - "${key}" → "${glossary[key]}"`)
    .join('\n')
}
```

## 사전 항목 추가

### 1. 파일 편집

```bash
code scripts/utils/dictionary.ts
```

### 2. 항목 추가

```typescript
const ck3Dictionaries: Record<string, string> = {
  // 기존 항목...
  
  // 새 항목 추가
  'baron': '남작',
  'count': '백작',
  'marquess': '후작',
}
```

### 3. 자동 무효화 (권장)

```bash
# dictionary.ts 파일을 수정하고 main 브랜치에 push
git add scripts/utils/dictionary.ts
git commit -m "feat: Add new translation terms"
git push origin main
```

GitHub Actions 워크플로우가 자동으로:
1. 사전 무효화 실행 (`update-dict`)
2. 재번역 실행 (`retranslate`)
3. 변경사항 커밋 및 푸시

**워크플로우 파일:** `.github/workflows/invalidate-on-dictionary-update.yml`

### 4. 수동 무효화 (필요시)

로컬에서 테스트하거나 즉시 무효화가 필요한 경우:

```bash
# 사전 무효화 (모든 키 무효화)
pnpm ck3:update-dict

# 재번역
pnpm ck3
```

이 명령은 사전에 있는 키를 포함한 모든 번역을 무효화하고 재번역합니다.

### 5. 커밋 기반 필터링 (권장)

특정 커밋 이후 변경된 딕셔너리 키만 무효화할 수 있습니다:

```bash
# 특정 커밋 이후 변경된 키만 무효화
pnpm ck3:update-dict -- --since-commit HEAD~3

# 커밋 범위 내 변경된 키만 무효화
pnpm ck3:update-dict -- --commit-range abc123..def456

# 특정 날짜 이후 변경된 키만 무효화
pnpm ck3:update-dict -- --since-date "2024-01-01"
pnpm ck3:update-dict -- --since-date "1 week ago"
```

**장점:**
- 전체 무효화 대비 작업 범위 축소
- 대규모 딕셔너리에서 효율적
- Git 히스토리 기반 정확한 변경 추적

## 사전 우선순위

번역 결정 트리에서 사전이 최고 우선순위를 갖습니다:

```
1. Dictionary (사전) ← 최고 우선순위
   ↓
2. Hash Match (변경 없음)
   ↓
3. Cache (이전 번역)
   ↓
4. AI Translation (새 번역)
```

**코드:**

```typescript
// 1. 사전 확인 (최우선)
if (hasDictionary(sourceValue, gameType)) {
  const dictTranslation = getDictionary(sourceValue, gameType)
  newYaml.l_korean[key] = [dictTranslation, sourceHash]
  continue
}

// 2. 해시 매칭
if (sourceHash === targetHash) {
  newYaml.l_korean[key] = [targetValue, targetHash]
  continue
}

// 3. 캐시 확인
// 4. AI 번역
```

## 사전 항목 가이드라인

### 1. 소문자 사용

사전 키는 대소문자를 무시하므로 소문자로 작성합니다.

```typescript
// 권장
'duke': '공작'

// 비권장 (동일하게 작동하지만 일관성 없음)
'Duke': '공작'
'DUKE': '공작'
```

**이유:**

```typescript
function normalizeKey(key: string): string {
  return key.toLowerCase()
}

hasDictionary('Duke', 'ck3')  // true
hasDictionary('DUKE', 'ck3')  // true
hasDictionary('duke', 'ck3')  // true
```

### 2. 단일 용어 우선

복합 문장보다 단일 용어를 우선적으로 추가합니다.

```typescript
// 권장
'duke': '공작'
'arrives': '도착합니다'

// 비권장 (너무 구체적)
'the duke arrives': '공작이 도착합니다'
```

**이유:** 단일 용어는 여러 문맥에서 재사용 가능합니다.

### 3. 게임 용어 우선

게임 고유 용어를 우선적으로 추가합니다.

```typescript
// 높은 우선순위
'stewardship': '관리력'     // 게임 고유 능력치
'duchy': '공국'             // 게임 고유 직함
'casus belli': '전쟁 명분'  // 게임 시스템

// 낮은 우선순위
'the': '그'                 // 일반 단어
'is': '이다'                // 일반 동사
```

### 4. 커뮤니티 표준 용어

한국 게임 커뮤니티에서 널리 사용되는 번역을 따릅니다.

```typescript
// 커뮤니티 표준
'duke': '공작'              // ✓ 널리 사용됨
'duke': '대공'              // ✗ 비표준

'stewardship': '관리력'     // ✓ 커뮤니티 표준
'stewardship': '집사력'     // ✗ 비표준
```

### 5. 고유명사 음차 표기

고유명사는 한글 음차로 표기합니다.

```typescript
// 지명
'karakoram': '카라코람'
'elephantine': '엘레판티네'

// 인명
'imhotep': '임호테프'
'prosdokimos': '프로스도키모스'

// 문화/종족명
'blemmye': '블렘미'
'sinhala': '싱할라'
```

### 6. 플레이스홀더

특수 플레이스홀더는 번역하지 않습니다.

```typescript
// 플레이스홀더 (RICE, VIET 모드에서 사용)
'xxxxx': 'xxxxx'

// 모드명 (번역하지 않음)
'RICE': 'RICE'
'VIET': 'VIET'
```

## CK3 사전 예제

### 직함

```typescript
'baron': '남작',
'count': '백작',
'duke': '공작',
'king': '왕',
'emperor': '황제',
'high king': '고왕',
```

### 능력치

```typescript
'basic skill': '기본 능력',
'stewardship': '관리력',
'martial': '군사력',
'diplomacy': '외교력',
'intrigue': '음모력',
'learning': '학식',
```

### 게임 시스템

```typescript
'casus belli': '전쟁 명분',
'senate': '원로원',
'landless': '비지주',
'hoftag': '궁중의회',
'italienzug': '이탈리엔추크',
```

### 역사/문화

```typescript
'blemmye': '블렘미',
'karakoram': '카라코람',
'elephantine': '엘레판티네',
'mastic': '유향',
```

## Stellaris 사전 예제

### 정치 체제

```typescript
'empire': '제국',
'federation': '연방',
'galactic community': '은하 공동체',
```

### 자원

```typescript
'unity': '통합',
'influence': '영향력',
'living metal': '생체 금속',
'zro': '즈로',
```

### 함선/시설

```typescript
'science ship': '과학선',
'construction ship': '건설선',
'research station': '연구소',
```

### 종족

```typescript
'pop': '팝',
'xenophobe': '배타주의자',
'xenophile': '포용주의자',
```

## VIC3 사전 예제

### 정치

```typescript
'authority': '권위',
'legitimacy': '정통성',
'prime minister': '총리',
```

### 경제

```typescript
'factory': '공장',
'railroad': '철도',
'standard of living': '생활 수준',
```

### 기술

```typescript
'production methods': '생산 방식',
'technology': '기술',
'innovation': '혁신',
```

## 사전 무효화 시스템

### 자동 무효화 (권장)

**트리거:** `scripts/utils/dictionary.ts` 파일이 main 브랜치에 push되면 자동 실행

**GitHub Actions 워크플로우:** `.github/workflows/invalidate-on-dictionary-update.yml`

```
# 자동으로 수행되는 작업:
1. CK3 사전 기반 번역 무효화
2. CK3 잘못된 번역 재번역
3. Stellaris 사전 기반 번역 무효화
4. Stellaris 잘못된 번역 재번역
5. VIC3 사전 기반 번역 무효화
6. VIC3 잘못된 번역 재번역
7. 변경사항 자동 커밋 및 푸시
```

**워크플로우 특징:**
- 모든 게임(CK3, Stellaris, VIC3)을 자동으로 처리
- `translation` concurrency group으로 다른 번역 워크플로우와 충돌 방지
- 각 게임은 독립적으로 처리되어 한 게임의 오류가 다른 게임에 영향을 주지 않음

### 수동 무효화

로컬 테스트나 즉시 처리가 필요한 경우:

**모듈:** `scripts/utils/dictionary-invalidator.ts`

```typescript
async function invalidateDictionaryTranslations(
  gameType: GameType,
  rootDir: string
) {
  // 1. 사전에서 모든 키 추출
  const dictionaries = getDictionaries(gameType)
  const dictionaryKeys = Object.keys(dictionaries).map(k => k.toLowerCase())
  
  // 2. 모든 번역 파일 스캔
  for (const mod of mods) {
    for (const file of files) {
      // 3. 각 항목이 사전 키를 포함하는지 확인
      for (const [key, [sourceText, hash]] of sourceEntries) {
        const normalized = sourceText.toLowerCase()
        
        for (const dictKey of dictionaryKeys) {
          if (normalized.includes(dictKey)) {
            // 4. 캐시 무효화
            await removeCache(hash, gameType)
            
            // 5. 해시를 null로 설정
            targetYaml['l_korean'][key][1] = null
            
            invalidatedCount++
            break
          }
        }
      }
    }
  }
}
```

### 사용 시나리오

#### 시나리오 1: 새 용어 추가

```typescript
// 1. 사전에 용어 추가
'baron': '남작'

// 2. 무효화 실행
pnpm ck3:update-dict

// 3. 영향받는 항목들
"The baron arrives" → 무효화
"A powerful baron" → 무효화
"Baron title" → 무효화
```

#### 시나리오 2: 기존 번역 수정

```typescript
// 기존 사전
'duke': '공작'

// 번역 결과
"The duke arrives" → "공작이 도착합니다"

// 사전 수정
'duke': '대공'

// 무효화 및 재번역
pnpm ck3:update-dict
pnpm ck3

// 새 번역 결과
"The duke arrives" → "대공이 도착합니다"
```

## AI 프롬프트 통합

### 번역 메모리 생성

```typescript
export function getTranslationMemories(gameType: GameType): string {
  const dictionaries = getDictionaries(gameType)
  
  return Object.keys(dictionaries)
    .map(key => ` - "${key}" → "${dictionaries[key]}"`)
    .join('\n')
}
```

### 시스템 프롬프트 포함

```typescript
const CK3_SYSTEM_PROMPT = `
You are an expert translator...

Translation Memory:
${getTranslationMemories('ck3')}

Now translate the following:
`
```

**효과:**

AI가 사전 항목을 참고하여 일관된 번역을 생성합니다.

```
Input: "The duke and his stewardship"

AI sees:
- "duke" → "공작"
- "stewardship" → "관리력"

Output: "공작과 그의 관리력"
```

## API

### `getDictionaries(gameType)`

게임별 사전 전체를 반환합니다.

```typescript
const dict = getDictionaries('ck3')
// { 'duke': '공작', 'stewardship': '관리력', ... }
```

### `hasDictionary(key, gameType)`

사전에 키가 존재하는지 확인합니다.

```typescript
hasDictionary('duke', 'ck3')  // true
hasDictionary('DUKE', 'ck3')  // true (대소문자 무시)
hasDictionary('xyz', 'ck3')   // false
```

### `getDictionary(key, gameType)`

사전에서 번역을 조회합니다.

```typescript
getDictionary('duke', 'ck3')  // "공작"
getDictionary('Duke', 'ck3')  // "공작" (대소문자 무시)
getDictionary('xyz', 'ck3')   // null
```

### `getTranslationMemories(gameType)`

AI 프롬프트용 번역 메모리를 생성합니다.

```typescript
const memories = getTranslationMemories('ck3')
/*
 - "duke" → "공작"
 - "stewardship" → "관리력"
 - "king" → "왕"
 ...
*/
```

## 모범 사례

### 1. 점진적 추가

```typescript
// 처음: 핵심 용어만
'duke': '공작'
'king': '왕'

// 사용하면서 발견되는 용어 추가
'baron': '남작'
'count': '백작'

// 지속적인 개선
'high king': '고왕'
'landless': '비지주'
```

### 2. 번역 일관성 검토

정기적으로 사전을 검토하여 일관성을 유지합니다.

```typescript
// 일관성 체크
'duke': '공작'
'duchy': '공국'      // ✓ 관련 용어 일관성

'king': '왕'
'kingdom': '왕국'    // ✓ 관련 용어 일관성
```

### 3. 주석 활용

복잡한 용어는 주석을 추가합니다.

```typescript
// 역사적 배경이 있는 용어
'hoftag': '궁중의회',        // 신성 로마 제국의 궁정 회의
'italienzug': '이탈리엔추크', // 이탈리아 원정

// 발음이 어려운 고유명사
'pełczybog': '펠치복',       // 폴란드어 발음
'bogyoszló': '보교슬로',     // 헝가리어 발음
```

### 4. 변형 형태 포함

명사의 다양한 형태를 포함합니다.

```typescript
// 단수/복수
'blemmye': '블렘미',
'blemmyes': '블렘미',
'blemmyae': '블렘미',

// 관련 용어
'duke': '공작',
'ducal': '공작의',
'duchy': '공국',
```

## 성능 영향

### 번역 속도

```typescript
// 사전 사용
처리 시간: ~1ms
대기 없음

// AI 번역
처리 시간: ~500ms
API 대기 시간 포함
```

### 비용 절감

```typescript
// 가정
const monthlyTranslations = 10000
const dictionaryHitRate = 0.30  // 30%

// 사전 없이
const apiCalls = monthlyTranslations
const cost = apiCalls * 0.0001  // $1.00

// 사전 사용
const apiCalls = monthlyTranslations * (1 - dictionaryHitRate)
const cost = apiCalls * 0.0001  // $0.70

// 절감: $0.30 (30%)
```

## 트러블슈팅

### 사전이 적용되지 않음

**증상:**
```
사전에 'duke': '공작'이 있지만 AI가 '대공'으로 번역
```

**원인:**
- 사전 무효화를 실행하지 않음
- 캐시에 이전 번역이 남아있음

**해결:**
```bash
pnpm ck3:update-dict  # 사전 기반 무효화
pnpm ck3              # 재번역
```

### 부분 매칭 문제

**증상:**
```
사전: 'duke': '공작'
입력: "archduke"
결과: "arch공작" (잘못된 번역)
```

**해결:**

사전은 완전 일치만 확인하므로 이 문제는 발생하지 않습니다.

```typescript
// 현재 구현: 완전 일치
if (hasDictionary(sourceValue, gameType)) {
  // "duke" !== "archduke"
}

// 만약 부분 매칭이 필요하다면 별도 구현 필요
```

## 다음 단계

- [검증 시스템](validation.md) - 번역 품질 검증
- [사용 가이드](usage.md) - 사전 업데이트 방법
- [API 레퍼런스](api-reference.md) - 사전 함수 상세

---

**팁:** 사전은 프로젝트의 번역 품질을 결정하는 핵심 요소입니다. 커뮤니티 피드백을 반영하여 지속적으로 개선하세요.
