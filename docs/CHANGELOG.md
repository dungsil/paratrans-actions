# 변경 로그

프로젝트의 주요 변경 사항 및 개선 사항을 기록합니다.

## 2025년 12월

### 번역 캐시 시스템 개선
**날짜:** 2025-12-08

**변경:**
- 번역 캐시 키에서 `github.run_id` 제거
- 워크플로우 실행마다 캐시가 무효화되는 문제 해결
- 동일한 캐시를 여러 실행 간 공유하여 번역 효율성 향상

**영향:**
- 번역 속도 개선
- API 호출 횟수 감소
- 캐시 재사용성 증가

**관련 파일:**
- `.github/workflows/translate-ck3.yml`
- `.github/workflows/translate-vic3.yml`
- `.github/workflows/translate-stellaris.yml`

---

### Git Corruption 문제 수정
**날짜:** 2025-12-07

**문제:**
- Self-hosted runner에서 `git fetch --unshallow` 실행 시 Git corruption 발생
- 불완전한 객체로 인한 워크플로우 실패

**해결:**
- `fetch-depth: 0`으로 전체 히스토리를 처음부터 가져오도록 변경
- `unshallow` 작업 제거로 corruption 위험 제거
- `clean: true` 옵션으로 깨끗한 체크아웃 보장

**관련 파일:**
- `.github/workflows/translate-ck3.yml`
- `.github/workflows/translate-vic3.yml`
- `.github/workflows/translate-stellaris.yml`
- `.github/workflows/invalidate-on-dictionary-update.yml`

---

### 단어사전 업데이트 시 번역 무효화 로직 재구현
**날짜:** 2025-12-05

**개선:**
- 단어사전 커밋 기반 필터링 로직 전면 재작성
- `--since-commit` 옵션이 해당 커밋의 변경사항만 정확히 추출하도록 수정
- Git log 파싱 로직 개선으로 정확도 향상

**변경사항:**
- 커밋 범위 계산 방식 개선
- 단어사전 섹션 감지 로직 강화
- 추출된 키의 정확성 향상

**관련 파일:**
- `scripts/utils/dictionary-changes.ts`
- `scripts/utils/dictionary-invalidator.ts`

---

### 번역 거부 추적 버그 수정
**날짜:** 2025-12-04

**문제:**
- 여러 모드 처리 시 `processes` 배열 스코프 문제로 번역 거부 추적 실패
- 모드별로 독립적인 프로세스 배열이 필요했으나 공유되는 문제

**해결:**
- 각 모드별로 독립적인 `processes` 배열 생성
- 번역 거부 항목이 올바르게 수집되도록 수정

**관련 파일:**
- `scripts/factory/translate.ts`

---

### 번역 거부 항목 추적 개선
**날짜:** 2025-12-04

**개선:**
- `untranslatedItems`에 번역 거부 항목 추적 기능 추가
- 번역 거부 발생 시 해당 항목이 올바르게 기록되도록 수정

**관련 파일:**
- `scripts/factory/translate.ts`

---

### 번역 거부 항목 자동 GitHub Issues 등록
**날짜:** 2025-12-03

**추가:**
- AI가 번역을 거부한 항목을 자동으로 GitHub Issues로 생성
- 모드별로 그룹화하여 이슈 생성
- `translation-refused` 및 게임별 레이블 자동 태깅
- 기존 열린 이슈가 있으면 코멘트로 추가
- 긴 메시지는 접을 수 있는 details 섹션으로 표시

**기능:**
- 번역 거부 항목 자동 감지
- JSON 형식으로 `{game}-untranslated-items.json`에 저장
- GitHub Issues 자동 생성 및 업데이트

**관련 파일:**
- `.github/workflows/translate-ck3.yml`
- `.github/workflows/translate-vic3.yml`
- `.github/workflows/translate-stellaris.yml`

---

### `--since-commit` 옵션 수정
**날짜:** 2025-12-02

**변경:**
- `--since-commit` 옵션이 해당 커밋만 확인하도록 수정
- 이전에는 커밋 이후의 모든 변경사항을 포함했으나, 특정 커밋만 확인하도록 개선

**관련 파일:**
- `scripts/utils/dictionary-changes.ts`

---

### 번역 거부 시 중간 저장 및 Graceful Exit
**날짜:** 2025-12-01

**추가:**
- AI가 번역을 거부할 때 처리된 항목까지 저장
- Graceful exit 처리로 부분 완료 상태 보존
- `TranslationRefusalStopError` 에러 클래스 추가

**기능:**
- 번역 거부 발생 시 이미 처리된 번역 결과 저장
- 에러 발생 지점과 사유 기록
- 다음 실행 시 중단된 지점부터 재개 가능

**관련 파일:**
- `scripts/factory/translate.ts`
- `scripts/utils/translate.ts`

---

### 검증 시스템 False Positive 수정
**날짜:** 2025-12-01 ~ 2025-12-02

**문제:**
- 완전한 변수에 인접한 리터럴 텍스트를 잘못 감지
- 변수 구분자 형식(괄호 타입) 변환을 false positive로 감지

**해결:**
- 리터럴 텍스트 감지 로직 개선
- 프롬프트에 변수 구분자 형식 변환 방지 규칙 추가

**관련 파일:**
- `scripts/utils/translation-validator.ts`
- `scripts/utils/prompts.ts`

---

### 단어사전 업데이트 워크플로우 개선
**날짜:** 2025-12-01

**개선:**
- `invalidate-on-dictionary-update` 워크플로우가 변경된 단어만 무효화
- `--since-commit ${{ github.sha }}` 옵션 사용으로 정확한 필터링
- 불필요한 재번역 최소화

**관련 파일:**
- `.github/workflows/invalidate-on-dictionary-update.yml`

---

### 주간 문서 자동화 워크플로우
**날짜:** 2025-12-01

**추가:**
- 매주 월요일 문서 현행화 요청 이슈 자동 생성
- 지난 7일간 변경사항 자동 수집
- `[skip ci]` 커밋 자동 제외
- 커밋 메시지의 특수문자로 인한 구문 오류 수정

**워크플로우:**
- `.github/workflows/weekly-docs-update.yml`

---

### "요청하신 대로" 검증 False Positive 수정
**날짜:** 2025-12-01

**문제:**
- "As requested" 번역인 "요청하신 대로"를 LLM 응답으로 오인

**해결:**
- 검증 패턴에서 "요청하신 대로" 제외

**관련 파일:**
- `scripts/utils/translation-validator.ts`

---

### 단어사전 업데이트
**날짜:** 2025-12-02 ~ 2025-12-07

**추가된 항목:**
- `hmu` (Hausa) 번역 추가
- `hkwi` (Hehe) 번역 추가
- `ult` (Ultimate) 번역 추가
- `yatim` 번역 추가
- 소문자 변형 항목 추가

**관련 파일:**
- `scripts/utils/dictionary.ts`

---

### 검증 시스템 대폭 개선
**날짜:** 2025-11-25 ~ 2025-12-01

**문제:**
- 복잡한 게임 변수 패턴 감지 부족
- 섹션 기호(§) 색상 코드 + 변수 조합 미지원
- 변수만으로 구성된 텍스트 잘못된 수정

**해결:**
- `§X$variable$§!` 패턴 지원
- 섹션 기호 색상 코드 + 파운드 변수 조합 지원: `§H£energy£`, `§BA£variable£`
- 변수만으로 구성된 텍스트 감지 개선으로 AI 수정 방지

**관련 파일:**
- `scripts/utils/translation-validator.ts`

---

### Upstream 업데이트 도구 필터링 기능
**날짜:** 2025-11-24

**추가:**
- 게임별 필터링: `pnpm upstream ck3`
- 모드별 필터링: `pnpm upstream ck3 RICE`
- 도움말 옵션: `pnpm upstream --help`

**사용 예:**
```bash
pnpm upstream ck3              # CK3 게임만
pnpm upstream ck3 RICE         # CK3의 RICE 모드만
pnpm upstream vic3 "Better Politics Mod"  # VIC3의 특정 모드만 (공백이 있으면 따옴표 사용)
```

**관련 파일:**
- `scripts/utils/upstream.ts`
- `scripts/upstream.ts`

---

### 단어사전 커밋 기반 필터링
**날짜:** 2025-11-24

**추가:**
- `--since-commit` 옵션: 특정 커밋 이후 변경된 키만 무효화
- `--commit-range` 옵션: 커밋 범위 내 변경된 키만 무효화
- `--since-date` 옵션: 특정 날짜 이후 변경된 키만 무효화

**사용 예:**
```bash
pnpm ck3:update-dict -- --since-commit HEAD~3
pnpm ck3:update-dict -- --commit-range abc123..def456
pnpm ck3:update-dict -- --since-date "2024-01-01"
```

**관련 파일:**
- `scripts/utils/dictionary-changes.ts` (새 파일)
- `scripts/utils/cli-args.ts` (새 파일)
- `scripts/utils/dictionary-invalidator.ts`

**문서 업데이트:**
- [사전 관리](dictionary.md)
- AGENTS.md

---

### CK3 단어사전 구조 개선
**날짜:** 2025-11-23

**변경:**
- 단어사전을 용어집(glossary)과 고유명사(proper nouns)로 분리
- 번역 메모리에는 용어집만 포함 (LLM 컨텍스트 최적화)
- 고유명사는 직접 매칭에만 사용

**구조:**
```typescript
const ck3Glossary = { ... }      // 번역 메모리에 포함
const ck3ProperNouns = { ... }   // 직접 매칭에만 사용
```

**관련 파일:**
- `scripts/utils/dictionary.ts`

---

### 대괄호 불균형 검증
**날짜:** 2025-11-22

**문제:**
- AI가 게임 변수의 닫는 `]`를 제거하는 오류 미감지
- 예: `[variable]` → `[variable`

**해결:**
- 번역 결과의 `[` 와 `]` 개수 비교 검증 추가
- 불균형 감지 시 재번역 트리거

**관련 파일:**
- `scripts/utils/translation-validator.ts`

---

### SQLite 안정성 개선
**날짜:** 2025-11-20 ~ 2025-11-22

**문제:**
- `SQLITE_IOERR_FSYNC` 오류 발생
- CI 환경에서 간헐적 I/O 오류

**해결:**
- `PRAGMA synchronous=NORMAL` 설정
- 지수 백오프를 사용한 재시도 로직 추가
- I/O 오류 시 디스크 사용률 표시

**관련 파일:**
- `scripts/utils/cache.ts`
- `scripts/utils/disk-usage.ts` (새 파일)

---

### Git 태그 정렬 개선
**날짜:** 2025-11-19 ~ 2025-11-21

**문제:**
- 알파벳 순 정렬로 잘못된 태그 선택 (예: v1.9 > v1.10)
- Sparse checkout에서 버전 태그 미적용

**해결:**
- GitHub Releases API 사용 및 git ls-remote 폴백으로 최신 태그 감지
- GitHub Releases API를 통한 시맨틱 버전 감지
- Shallow clone에서 버전 태그 존중

**관련 파일:**
- `scripts/utils/upstream.ts`

---

## 2025년 11월

### Upstream 관리 최적화
**날짜:** 2025-11-19

**문제:**
- 대용량 upstream 리포지토리 클론 시 디스크 공간 부족 문제 발생
- CI/CD 환경에서 빌드 실패

**해결:**
- `git clone`에 `--depth=1` 옵션 추가
- Shallow clone으로 전체 히스토리 다운로드 방지
- 기존 shallow clone 업데이트 시 자동 `--unshallow` 처리

**영향:**
- 디스크 사용량 최대 90% 감소
- CI/CD 빌드 시간 단축
- 더 안정적인 upstream 동기화

**관련 파일:**
- `scripts/utils/upstream.ts`
- `scripts/utils/upstream.test.ts` (새 파일)

**문서 업데이트:**
- [아키텍처](architecture.md) - Upstream Management 섹션

---

### 번역되지 않은 항목 추적
**날짜:** 2025-11-10

**문제:**
- AI가 일부 항목을 번역하지 않고 원문 그대로 반환하는 경우 감지 어려움
- 번역 품질 모니터링 필요

**해결:**
- `processLanguageFile()` 함수가 `UntranslatedItem[]` 반환하도록 변경
- 번역 스크립트 완료 시 번역되지 않은 항목 자동 로깅
- 파일명, 키, 원문 메시지 출력

**영향:**
- 번역 품질 모니터링 개선
- 디버깅 용이성 향상
- 공유 가변 상태 제거로 동시성 문제 방지

**관련 파일:**
- `scripts/factory/translate.ts`
- `scripts/factory/translate.test.ts`

**문서 업데이트:**
- [아키텍처](architecture.md) - Translation Factory 섹션

---

### 검증 시스템 개선
**날짜:** 2025-11-09

**문제:**
- 게임 변수 내 문자열 리터럴에 포함된 달러 변수를 잘못 감지
- `[Concatenate('$gold$', other)]` 같은 유효한 패턴이 False Positive로 감지됨
- Concept 변수 사용 시 불필요한 재번역 발생

**해결:**
- 문자열 리터럴 감지 헬퍼 함수 추가 (`isInsideStringLiteral`)
- 잘못된 변수 패턴 감지 시 문자열 리터럴 내부 제외
- 11개 포괄적 테스트 케이스 추가 (총 208개 테스트)

**영향:**
- False Positive 대폭 감소
- Concept 변수 정확도 향상
- 더 정확한 번역 품질 검증

**관련 파일:**
- `scripts/utils/translation-validator.ts`
- `scripts/utils/translation-validator.test.ts`

**문서 업데이트:**
- [검증 시스템](validation.md) - 잘못된 변수 구문 감지 섹션

---

## 2025년 10월

### 문서 체계 구축
**날짜:** 2025-10-13

**추가된 문서:**
- 총 22개의 종합 문서 파일 (9,500+ 줄)
- 핵심 문서: 개요, 아키텍처, 사용 가이드, 설정 가이드
- 기술 문서: 번역 파이프라인, API 레퍼런스, 캐싱, 검증, 사전
- 고급 문서: 개발 가이드, 요구사항, 재구현 가이드
- 이슈 해결: 크래시 분석, 검증 오탐 수정, 검증 결과

**특징:**
- 한국어 문서
- 4가지 학습 경로 제공
- 180+ 코드 예제
- 15+ 다이어그램

---

### 검증 오탐 수정 (2025-10 이전)
**문제:**
- 완전한 변수 뒤에 텍스트가 바로 붙는 경우 오류로 잘못 감지
- 예: `$gold$12 세기`를 `$12`를 잘못된 변수로 감지

**해결:**
- 변수 검증 로직 개선
- 완전한 변수와 후속 텍스트 구분

**관련 문서:**
- [검증 오탐 상세](fix-validation-false-positive.md)
- [수정 요약](summary-fix.md)

---

### CK3 RICE 모드 크래시 수정 (2025-10 이전)
**문제:**
- 214개의 잘못된 변수 패턴 (`$[`) 발견
- 게임 크래시 발생

**해결:**
- 잘못된 패턴 자동 감지 및 수정
- 검증 시스템 강화

**관련 문서:**
- [크래시 분석](crash-analysis.md)
- [크래시 수정](crash-fix-readme.md)
- [검증 결과](verification-results.md)

---

## 문서 규칙

이 변경 로그는 다음 형식을 따릅니다:

```markdown
### 기능/수정 제목 (PR 번호)
**날짜:** YYYY-MM-DD

**문제:**
- 발생한 문제 설명

**해결:**
- 적용한 해결 방법

**영향:**
- 변경으로 인한 영향

**관련 파일:**
- 변경된 파일 목록

**문서 업데이트:**
- 업데이트된 문서 링크
```

---

## 추가 정보

변경 사항에 대한 자세한 내용은 각 문서를 참조하세요.
