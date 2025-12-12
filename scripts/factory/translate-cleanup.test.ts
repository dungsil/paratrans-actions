import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'pathe'
import { tmpdir } from 'node:os'

// 의존성 모킹
vi.mock('../utils/logger', () => ({
  log: {
    start: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../utils/translate', () => ({
  translate: vi.fn((text: string) => Promise.resolve(`[KO]${text}`)),
  TranslationRetryExceededError: class TranslationRetryExceededError extends Error {
    constructor() {
      super()
      this.name = 'TranslationRetryExceededError'
    }
  },
  TranslationRefusedError: class TranslationRefusedError extends Error {
    constructor(public readonly text: string, public readonly reason: string) {
      super(`번역 거부: ${text} (사유: ${reason})`)
      this.name = 'TranslationRefusedError'
    }
  }
}))

vi.mock('../utils/upstream', () => ({
  updateAllUpstreams: vi.fn(() => Promise.resolve())
}))

describe('파일 정리 및 빈 파일 방지', () => {
  let testDir: string

  beforeEach(async () => {
    // 테스트를 위한 임시 디렉토리 생성
    testDir = join(tmpdir(), `translate-cleanup-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // 정리
    vi.restoreAllMocks()
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // 정리 오류 무시
    }
  })

  it('업스트림에서 삭제된 파일은 한국어 번역 파일도 삭제되어야 함', async () => {
    const { processModTranslations } = await import('./translate')

    // meta.toml 및 디렉토리 구조 생성
    const modDir = join(testDir, 'test-mod')
    const upstreamDir = join(modDir, 'upstream')
    const koreanDir = join(modDir, 'mod', 'localization', 'korean')
    
    const metaContent = `
[upstream]
localization = ["."]
language = "english"
`
    await mkdir(upstreamDir, { recursive: true })
    await mkdir(koreanDir, { recursive: true })
    await writeFile(join(modDir, 'meta.toml'), metaContent, 'utf-8')
    
    // 초기 상태: upstream에 2개의 파일 존재
    await writeFile(join(upstreamDir, 'file1_l_english.yml'), `l_english:
 key1:0 "Value 1"
`, 'utf-8')
    await writeFile(join(upstreamDir, 'file2_l_english.yml'), `l_english:
 key2:0 "Value 2"
`, 'utf-8')

    // 첫 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    // 두 파일 모두 생성되었는지 확인
    const file1Output = join(koreanDir, '___file1_l_korean.yml')
    const file2Output = join(koreanDir, '___file2_l_korean.yml')
    await access(file1Output)
    await access(file2Output)

    // upstream에서 file2 삭제
    await rm(join(upstreamDir, 'file2_l_english.yml'))

    // 두 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    // file1은 여전히 존재해야 함
    await access(file1Output)
    
    // file2는 삭제되어야 함
    expect(existsSync(file2Output)).toBe(false)
  })

  it('빈 YAML 파일(항목이 없는 파일)은 생성하지 않아야 함', async () => {
    const { processModTranslations } = await import('./translate')

    const modDir = join(testDir, 'test-mod')
    const upstreamDir = join(modDir, 'upstream')
    const koreanDir = join(modDir, 'mod', 'localization', 'korean')
    
    const metaContent = `
[upstream]
localization = ["."]
language = "english"
`
    await mkdir(upstreamDir, { recursive: true })
    await writeFile(join(modDir, 'meta.toml'), metaContent, 'utf-8')
    
    // 항목이 없는 파일 생성 (주석만 있음)
    await writeFile(join(upstreamDir, 'empty_l_english.yml'), `l_english:
# This file has no entries
`, 'utf-8')

    // 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    // 빈 파일은 생성되지 않아야 함
    const emptyOutput = join(koreanDir, '___empty_l_korean.yml')
    expect(existsSync(emptyOutput)).toBe(false)
  })

  it('기존에 존재하던 한국어 파일이 업스트림에서 빈 파일로 변경되면 삭제되어야 함', async () => {
    const { processModTranslations } = await import('./translate')

    const modDir = join(testDir, 'test-mod')
    const upstreamDir = join(modDir, 'upstream')
    const koreanDir = join(modDir, 'mod', 'localization', 'korean')
    
    const metaContent = `
[upstream]
localization = ["."]
language = "english"
`
    await mkdir(upstreamDir, { recursive: true })
    await writeFile(join(modDir, 'meta.toml'), metaContent, 'utf-8')
    
    // 초기: 항목이 있는 파일
    await writeFile(join(upstreamDir, 'test_l_english.yml'), `l_english:
 key1:0 "Value 1"
`, 'utf-8')

    // 첫 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    const testOutput = join(koreanDir, '___test_l_korean.yml')
    await access(testOutput) // 파일이 생성됨
    
    // upstream 파일을 빈 파일로 변경
    await writeFile(join(upstreamDir, 'test_l_english.yml'), `l_english:
# No entries
`, 'utf-8')

    // 두 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    // 빈 파일은 삭제되어야 함
    expect(existsSync(testOutput)).toBe(false)
  })

  it('여러 파일 중 일부만 삭제되면 나머지 파일은 유지되어야 함', async () => {
    const { processModTranslations } = await import('./translate')

    const modDir = join(testDir, 'test-mod')
    const upstreamDir = join(modDir, 'upstream')
    const koreanDir = join(modDir, 'mod', 'localization', 'korean')
    
    const metaContent = `
[upstream]
localization = ["."]
language = "english"
`
    await mkdir(upstreamDir, { recursive: true })
    await writeFile(join(modDir, 'meta.toml'), metaContent, 'utf-8')
    
    // 초기: 3개의 파일
    await writeFile(join(upstreamDir, 'file1_l_english.yml'), `l_english:
 key1:0 "Value 1"
`, 'utf-8')
    await writeFile(join(upstreamDir, 'file2_l_english.yml'), `l_english:
 key2:0 "Value 2"
`, 'utf-8')
    await writeFile(join(upstreamDir, 'file3_l_english.yml'), `l_english:
 key3:0 "Value 3"
`, 'utf-8')

    // 첫 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    const file1Output = join(koreanDir, '___file1_l_korean.yml')
    const file2Output = join(koreanDir, '___file2_l_korean.yml')
    const file3Output = join(koreanDir, '___file3_l_korean.yml')
    
    // 3개 파일 모두 존재
    await access(file1Output)
    await access(file2Output)
    await access(file3Output)

    // file2만 업스트림에서 삭제
    await rm(join(upstreamDir, 'file2_l_english.yml'))

    // 두 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    // file1과 file3는 유지
    await access(file1Output)
    await access(file3Output)
    
    // file2는 삭제됨
    expect(existsSync(file2Output)).toBe(false)
  })

  it('하위 디렉토리의 파일도 올바르게 정리되어야 함', async () => {
    const { processModTranslations } = await import('./translate')

    const modDir = join(testDir, 'test-mod')
    const upstreamDir = join(modDir, 'upstream')
    const subDir = join(upstreamDir, 'subdir')
    const koreanDir = join(modDir, 'mod', 'localization', 'korean')
    
    const metaContent = `
[upstream]
localization = ["."]
language = "english"
`
    await mkdir(subDir, { recursive: true })
    await writeFile(join(modDir, 'meta.toml'), metaContent, 'utf-8')
    
    // 하위 디렉토리에 파일 생성
    await writeFile(join(subDir, 'nested_l_english.yml'), `l_english:
 key1:0 "Value 1"
`, 'utf-8')

    // 첫 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    const nestedOutput = join(koreanDir, 'subdir', '___nested_l_korean.yml')
    await access(nestedOutput) // 파일 생성됨

    // upstream에서 파일 삭제
    await rm(join(subDir, 'nested_l_english.yml'))

    // 두 번째 번역 실행
    await processModTranslations({
      rootDir: testDir,
      mods: ['test-mod'],
      gameType: 'ck3',
      onlyHash: false
    })

    // 파일이 삭제되어야 함
    expect(existsSync(nestedOutput)).toBe(false)
  })
})
