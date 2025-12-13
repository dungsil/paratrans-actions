# Create Untranslated Items Issues

번역되지 않은 항목이 있을 때 자동으로 GitHub 이슈를 생성하거나 업데이트하는 GitHub Action입니다.

## 사용법

```yaml
- name: Create issue for untranslated items
  if: always()
  uses: ./.github/actions/create-untranslated-issues
  with:
    game: 'ck3'  # 게임 식별자: ck3, vic3, stellaris
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## 입력

- `game` (필수): 게임 식별자 (`ck3`, `vic3`, `stellaris`)
- `github-token` (필수): GitHub API 접근을 위한 토큰

## 동작 방식

1. `{game}-untranslated-items.json` 파일을 읽습니다.
2. 파일이 존재하고 번역되지 않은 항목이 있으면:
   - 모드별로 항목을 그룹화합니다.
   - 각 모드에 대해 기존 이슈가 있는지 확인합니다.
   - 기존 이슈가 있으면 새로운 항목만 추가하여 업데이트합니다.
   - 기존 이슈가 없으면 새 이슈를 생성합니다.
3. 이슈는 `translation-refused` 및 게임별 레이블이 자동으로 추가됩니다.

## 특징

- 중복 항목 자동 감지 및 제거
- 긴 메시지는 접을 수 있는 섹션으로 표시
- 이슈 본문의 테이블 형식으로 깔끔하게 정리
- 마지막 업데이트 시간 자동 기록
