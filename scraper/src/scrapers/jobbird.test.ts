import { describe, it, expect } from 'vitest'
import { buildSearchUrl } from './jobbird.js'
describe('buildSearchUrl', () => {
  it('targets jobbird.com', () => { expect(buildSearchUrl('interim', {})).toContain('jobbird.com') })
  it('sets country=nl', () => { expect(buildSearchUrl('interim', {})).toContain('country=nl') })
})
