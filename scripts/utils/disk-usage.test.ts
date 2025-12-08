import { describe, it, expect } from 'vitest'
import { formatDiskUsage, DiskUsageInfo } from './disk-usage'

describe('disk-usage', () => {
  describe('formatDiskUsage', () => {
    it('디스크 사용률 정보를 읽기 쉬운 문자열로 포맷해야 함', () => {
      const info: DiskUsageInfo = {
        totalGB: 100,
        usedGB: 50,
        availableGB: 50,
        usagePercent: 50
      }
      
      const result = formatDiskUsage(info)
      
      expect(result).toContain('디스크 사용률')
      expect(result).toContain('50%')
      expect(result).toContain('50GB')
      expect(result).toContain('100GB')
    })
  })
})
