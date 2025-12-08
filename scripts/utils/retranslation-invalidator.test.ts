import { describe, it, expect } from 'vitest'
import { getLocalizationFolderName } from './retranslation-invalidator'

describe('재번역 무효화', () => {
  describe('getLocalizationFolderName', () => {
    it('CK3는 localization 폴더를 반환해야 함', () => {
      expect(getLocalizationFolderName('ck3')).toBe('localization')
    })

    it('VIC3는 localization 폴더를 반환해야 함', () => {
      expect(getLocalizationFolderName('vic3')).toBe('localization')
    })

    it('Stellaris는 localisation 폴더를 반환해야 함 (영국식 철자)', () => {
      expect(getLocalizationFolderName('stellaris')).toBe('localisation')
    })

    it('지원하지 않는 게임 타입에 대해 오류를 발생시켜야 함', () => {
      expect(() => getLocalizationFolderName('invalid' as any)).toThrow('Unsupported game type: invalid')
    })
  })
})
