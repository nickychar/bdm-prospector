import { describe, it, expect } from 'vitest'
import { buildSearchUrl } from './monsterboard.js'
describe('buildSearchUrl', () => {
  it('targets monsterboard.nl', () => { expect(buildSearchUrl('interim', {})).toContain('monsterboard.nl') })
  it('includes Nederland location', () => { expect(buildSearchUrl('interim', {})).toContain('Nederland') })
})
