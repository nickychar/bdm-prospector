import { describe, it, expect } from 'vitest'
import { buildSearchUrl } from './intermediair.js'
describe('buildSearchUrl', () => {
  it('targets intermediair.nl', () => { expect(buildSearchUrl('directeur', {})).toContain('intermediair.nl') })
})
