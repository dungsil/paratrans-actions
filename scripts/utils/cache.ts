import { createDatabase } from 'db0'
import libSql from 'db0/connectors/libsql/node'
import { createStorage } from 'unstorage'
import dbDriver from 'unstorage/drivers/db0'
import { type GameType } from './prompts'
import { delay } from './delay'
import { log } from './logger'

const database = createDatabase(libSql({ url: `file:translate-cache.db` }));

// PRAGMA synchronous=NORMAL 설정으로 fsync 관련 오류 감소
// NORMAL 모드는 FULL보다 덜 엄격하지만 캐시 용도로는 충분한 안전성 제공
database.sql`PRAGMA synchronous=NORMAL`.catch((error) => {
  log.debug(`PRAGMA synchronous 설정 실패 (무시됨): ${error instanceof Error ? error.message : String(error)}`)
})

const translationCache = createStorage({
  driver: dbDriver({
    database,
  })
})

// SQLite I/O 오류 시 재시도 상수
// 더 많은 재시도와 더 긴 대기 시간으로 일시적인 디스크 I/O 오류 복구 가능성 향상
const MAX_RETRIES = 7
const INITIAL_DELAY_MS = 500
const MAX_DELAY_MS = 10000
const JITTER_FACTOR = 0.2 // 대기 시간의 0~20% 랜덤 변동

/**
 * SQLite I/O 오류인지 확인
 */
export function isSqliteIOError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('sqlite_ioerr') || 
           message.includes('disk i/o error') ||
           message.includes('database is locked')
  }
  return false
}

/**
 * 지수 백오프와 지터를 사용한 재시도 래퍼
 * 디스크 I/O 오류 복구를 위해 더 긴 대기 시간과 랜덤 지터 적용
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (!isSqliteIOError(error)) {
        throw error
      }
      
      if (attempt < MAX_RETRIES - 1) {
        // 지수 백오프: 500ms, 1000ms, 2000ms, 4000ms, 8000ms, 10000ms (최대)
        // 지터 추가: 대기 시간의 0~20% 랜덤 변동으로 동시 재시도 충돌 방지
        const baseDelay = Math.min(INITIAL_DELAY_MS * (2 ** attempt), MAX_DELAY_MS)
        const jitter = Math.random() * baseDelay * JITTER_FACTOR
        const delayMs = Math.floor(baseDelay + jitter)
        await delay(delayMs)
      }
    }
  }
  
  throw lastError
}

function getCacheKey(key: string, gameType: GameType): string {
  // 모든 게임 타입에 대해 통일된 형식 사용: gameType:key
  return `${gameType}:${key}`
}

export async function hasCache (key: string, gameType: GameType = 'ck3'): Promise<boolean> {
  return await withRetry(
    () => translationCache.hasItem(getCacheKey(key, gameType))
  )
}

export async function getCache (key: string, gameType: GameType = 'ck3'): Promise<string | null> {
  return await withRetry(
    () => translationCache.getItem<string>(getCacheKey(key, gameType))
  )
}

export async function setCache (key: string, value: string, gameType: GameType = 'ck3'): Promise<void> {
  await withRetry(
    () => translationCache.setItem(getCacheKey(key, gameType), value)
  )
}

export async function removeCache(key: string, gameType: GameType = 'ck3'): Promise<void> {
  await withRetry(
    () => translationCache.removeItem(getCacheKey(key, gameType))
  )
}
