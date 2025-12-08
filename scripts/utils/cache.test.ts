import { describe, it, expect, afterEach } from 'vitest'
import { hasCache, getCache, setCache, removeCache } from './cache'

describe('캐시', () => {
  afterEach(async () => {
    // 테스트 캐시 항목 정리
    try {
      await removeCache('test-key-1', 'ck3')
      await removeCache('test-key-2', 'ck3')
      await removeCache('test-key-stellaris', 'stellaris')
      await removeCache('test-key-vic3', 'vic3')
    } catch (error) {
      // 정리 오류 무시
    }
  })

  describe('setCache와 getCache', () => {
    it('캐시 값을 저장하고 조회할 수 있어야 함', async () => {
      await setCache('test-key-1', 'test-value', 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe('test-value')
    })

    it('존재하지 않는 키에 대해 null을 반환해야 함', async () => {
      const value = await getCache('non-existent-key', 'ck3')
      
      expect(value).toBe(null)
    })

    it('기존 캐시 값을 덮어쓸 수 있어야 함', async () => {
      await setCache('test-key-2', 'value1', 'ck3')
      await setCache('test-key-2', 'value2', 'ck3')
      const value = await getCache('test-key-2', 'ck3')
      
      expect(value).toBe('value2')
    })
  })

  describe('hasCache', () => {
    it('존재하는 캐시 키에 대해 true를 반환해야 함', async () => {
      await setCache('test-key-1', 'value', 'ck3')
      const exists = await hasCache('test-key-1', 'ck3')
      
      expect(exists).toBe(true)
    })

    it('존재하지 않는 키에 대해 false를 반환해야 함', async () => {
      const exists = await hasCache('non-existent-key', 'ck3')
      
      expect(exists).toBe(false)
    })
  })

  describe('removeCache', () => {
    it('기존 캐시 항목을 제거할 수 있어야 함', async () => {
      await setCache('test-key-1', 'value', 'ck3')
      await removeCache('test-key-1', 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe(null)
    })
  })

  describe('게임 타입 격리', () => {
    it('CK3와 Stellaris 캐시를 격리해야 함', async () => {
      await setCache('test-key-stellaris', 'ck3-value', 'ck3')
      await setCache('test-key-stellaris', 'stellaris-value', 'stellaris')
      
      const ck3Value = await getCache('test-key-stellaris', 'ck3')
      const stellarisValue = await getCache('test-key-stellaris', 'stellaris')
      
      expect(ck3Value).toBe('ck3-value')
      expect(stellarisValue).toBe('stellaris-value')
    })

    it('세 가지 게임 타입을 모두 격리해야 함', async () => {
      await setCache('shared-key', 'ck3-value', 'ck3')
      await setCache('shared-key', 'stellaris-value', 'stellaris')
      await setCache('shared-key', 'vic3-value', 'vic3')
      
      const ck3Value = await getCache('shared-key', 'ck3')
      const stellarisValue = await getCache('shared-key', 'stellaris')
      const vic3Value = await getCache('shared-key', 'vic3')
      
      expect(ck3Value).toBe('ck3-value')
      expect(stellarisValue).toBe('stellaris-value')
      expect(vic3Value).toBe('vic3-value')
    })
  })
})
