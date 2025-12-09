import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TranslationRefusedError } from './ai'

// delay와 logger를 최소 동작으로 모킹
vi.mock('./delay', () => ({
  delay: vi.fn(() => Promise.resolve())
}))

const logSpies = vi.hoisted(() => ({
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
}))

vi.mock('./logger', () => ({
  log: logSpies
}))

describe('큐 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('작업이 순차 실행되고 Promise가 resolve되어야 함', async () => {
    const { addQueue } = await import('./queue')
    const order: string[] = []

    const first = addQueue('t1', async () => { order.push('첫번째') })
    const second = addQueue('t2', async () => { order.push('두번째') })

    await Promise.all([first, second])
    expect(order).toEqual(['첫번째', '두번째'])
  })

  it('TranslationRefusedError 발생 시 Promise가 reject되어야 함', async () => {
    const { addQueue } = await import('./queue')

    const promise = addQueue('refuse', async () => {
      throw new TranslationRefusedError('text', 'reason')
    })

    await expect(promise).rejects.toBeInstanceOf(TranslationRefusedError)
  })

  it('일반 오류는 재시도 후 성공하면 resolve되어야 함', async () => {
    const { addQueue } = await import('./queue')
    const delayMock = (await import('./delay')).delay as unknown as vi.Mock

    const task = vi.fn()
      .mockRejectedValueOnce(new Error('일시 오류'))
      .mockResolvedValueOnce(undefined)

    await addQueue('retry', async () => task())

    expect(task).toHaveBeenCalledTimes(2)
    expect(delayMock).toHaveBeenCalled()
  })

  it('TranslationRefusedError 발생 시 남은 작업들도 모두 reject되어야 함', async () => {
    const { addQueue } = await import('./queue')
    
    // 첫 번째 작업은 TranslationRefusedError를 발생시킴
    const firstPromise = addQueue('first', async () => {
      throw new TranslationRefusedError('text', 'reason')
    })
    
    // 두 번째와 세 번째 작업은 큐에 대기
    const secondPromise = addQueue('second', async () => {
      // 이 작업은 실행되지 않아야 함
    })
    const thirdPromise = addQueue('third', async () => {
      // 이 작업도 실행되지 않아야 함
    })

    // 첫 번째는 TranslationRefusedError로 reject
    await expect(firstPromise).rejects.toBeInstanceOf(TranslationRefusedError)
    
    // 나머지는 cascading error로 reject
    await expect(secondPromise).rejects.toThrow('큐 처리가 이전 에러로 인해 중단됨')
    await expect(thirdPromise).rejects.toThrow('큐 처리가 이전 에러로 인해 중단됨')
  })

  it('일반 오류가 MAX_RETRIES 초과 시 reject되어야 함', async () => {
    const { addQueue } = await import('./queue')
    const delayMock = (await import('./delay')).delay as unknown as vi.Mock
    
    // 6번 연속 실패하는 작업 (초기 시도 1회 + 재시도 5회)
    const task = vi.fn().mockRejectedValue(new Error('지속적인 오류'))

    const promise = addQueue('max-retry', async () => task())

    await expect(promise).rejects.toThrow('지속적인 오류')
    // 초기 시도 1회 + 재시도 5회 = 총 6회
    expect(task).toHaveBeenCalledTimes(6)
    // 재시도 5회에 대한 delay 호출
    expect(delayMock).toHaveBeenCalledTimes(5)
  })

  it('일반 오류는 여러 번 재시도 후 성공하면 resolve되어야 함', async () => {
    const { addQueue } = await import('./queue')
    const delayMock = (await import('./delay')).delay as unknown as vi.Mock

    // 3번 실패 후 성공
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('첫 번째 오류'))
      .mockRejectedValueOnce(new Error('두 번째 오류'))
      .mockRejectedValueOnce(new Error('세 번째 오류'))
      .mockResolvedValueOnce(undefined)

    await addQueue('multi-retry', async () => task())

    // 초기 시도 1회 + 재시도 3회 = 총 4회
    expect(task).toHaveBeenCalledTimes(4)
    // 재시도 3회에 대한 delay 호출
    expect(delayMock).toHaveBeenCalledTimes(3)
  })
})
