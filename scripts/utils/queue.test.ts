import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { addQueue } from './queue'

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
  })
})
