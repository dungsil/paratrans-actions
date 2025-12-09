import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { addQueue } from './queue'
import { TranslationRefusedError } from './ai'

// 테스트 중 로그 출력을 억제하기 위해 logger를 mock
vi.mock('./logger', () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}))

describe('큐', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('addQueue', () => {
    it('큐에 추가된 작업을 실행해야 함', async () => {
      const mockTask = vi.fn().mockResolvedValue(undefined)
      
      addQueue('test-key', mockTask)
      
      // 작업 처리 대기
      await vi.runAllTimersAsync()
      
      expect(mockTask).toHaveBeenCalledTimes(1)
    })

    it('작업을 순차적으로 처리해야 함', async () => {
      const executionOrder: number[] = []
      
      const task1 = vi.fn(async () => {
        executionOrder.push(1)
      })
      const task2 = vi.fn(async () => {
        executionOrder.push(2)
      })
      const task3 = vi.fn(async () => {
        executionOrder.push(3)
      })
      
      addQueue('key1', task1)
      addQueue('key2', task2)
      addQueue('key3', task3)
      
      await vi.runAllTimersAsync()
      
      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('실패 시 재시도해야 함', async () => {
      let attemptCount = 0
      const mockTask = vi.fn(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
      })
      
      addQueue('test-key', mockTask)
      
      // 재시도 실행
      await vi.runAllTimersAsync()
      
      // 3번 시도해야 함 (초기 + 2번 재시도)
      expect(mockTask).toHaveBeenCalledTimes(3)
    })

    it('TranslationRefusedError는 재시도 없이 즉시 전파해야 함', async () => {
      const error = new TranslationRefusedError('test text', 'PROHIBITED_CONTENT')
      let caughtError: unknown = null
      const mockTask = vi.fn(async () => {
        throw error
      })
      
      // addQueue 호출
      addQueue('test-key', mockTask)
      
      // 큐 처리 - 에러는 비동기적으로 발생하여 unhandled rejection이 됨
      // try-catch는 동기적으로 발생하는 에러만 잡을 수 있으므로, 
      // 실제로 catch되지 않지만 타입 안전성을 위해 검증 추가
      try {
        await vi.runAllTimersAsync()
      } catch (err) {
        caughtError = err
        // 만약 에러가 catch된다면 올바른 타입인지 확인
        expect(err).toBeInstanceOf(TranslationRefusedError)
      }
      
      // 핵심 검증: 재시도 없이 한 번만 실행되어야 함
      // TranslationRefusedError가 발생하면 재시도 로직을 건너뛰고 즉시 전파됨
      expect(mockTask).toHaveBeenCalledTimes(1)
      
      // Note: 이 테스트에서는 unhandled rejection 경고가 예상됨
      // 이는 큐 시스템이 의도적으로 에러를 상위로 전파하기 때문
    })
  })
})
