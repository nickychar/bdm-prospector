import { describe, it, expect } from 'vitest'
import { buildSearchUrl } from './stepstone-nl.js'
describe('buildSearchUrl', () => {
  it('targets stepstone.nl', () => { expect(buildSearchUrl('interim', {})).toContain('stepstone.nl') })
})
