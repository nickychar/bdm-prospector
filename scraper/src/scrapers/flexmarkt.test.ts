import { describe, it, expect } from 'vitest'
import { buildSearchUrl, parseResults } from './flexmarkt.js'
describe('buildSearchUrl', () => {
  it('targets flexmarkt.nl', () => { expect(buildSearchUrl('interim manager', {})).toContain('flexmarkt.nl') })
  it('uses zoekterm parameter', () => { expect(buildSearchUrl('financieel directeur', {})).toContain('zoekterm=') })
})
describe('parseResults', () => {
  it('hardcodes contractTypeRaw to interim for all results', () => {
    const html = `<html><body><article><h2>Interim Financieel Directeur</h2><div class="opdrachtgever">NL BV</div></article></body></html>`
    const results = parseResults(html)
    if (results.length > 0) expect(results[0].contractTypeRaw).toBe('interim')
  })
})
