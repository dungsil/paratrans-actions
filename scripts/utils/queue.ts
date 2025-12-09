import { TranslationRefusedError } from './ai'
import { delay } from './delay'
import { log } from './logger'

type Queue = { key: string, queue: () => Promise<void> }
const translationQueue: Queue[] = []

const MAX_RETRIES = 5
const RETRY_DELAYS = [0, 1_000, 2_000, 8_000, 10_000, 60_000] // 밀리초 단위

let lastRequestTime = 0

export async function addQueue (key: string, newQueue: () => Promise<void>) {
  translationQueue.push({ key, queue: newQueue })

  processQueue()
}

async function processQueue () {
  // 큐가 없으면 종료
  if (translationQueue.length === 0) {
    return
  }

  // 초당 최대 4개까지만 요청을 보낼 수 있도록 제한
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < 100) {
    setTimeout(processQueue, 100 - timeSinceLastRequest)
    return
  }

  const task = translationQueue.shift()
  if (task?.queue != null) {
    lastRequestTime = now
    await executeTaskWithRetry(task)

    // 처리 완료후 세로운 큐 실행
    processQueue()
  }
}

async function executeTaskWithRetry (task: Queue, retryCount = 0): Promise<void> {
  try {
    await task.queue()
  } catch (error) {
    // TranslationRefusedError는 재시도 없이 즉시 전파
    if (error instanceof TranslationRefusedError) {
      throw error
    }

    const message = (error as Error).message
    if (message) {
      if (!message.includes('429 Too Many Requests')) {
        log.warn('[', task.key ,']요청 실패:', (error as Error).message)
        log.debug('\t', error)
      }
    }

    if (retryCount < MAX_RETRIES) {
      log.info(`요청에 실패하여 잠시후 다시 시도합니다. (${retryCount + 1})`)

      // 지수 백오프
      const retryDelay = RETRY_DELAYS[retryCount + 1]
      await delay(retryDelay)

      // 재시도
      return executeTaskWithRetry(task, retryCount + 1)
    } else {
      log.error('[', task.key, ']', '재시도 횟수가 초과되어 종료됩니다:', error)
      throw error
    }
  }
}
