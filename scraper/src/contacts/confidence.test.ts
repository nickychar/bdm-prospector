// scraper/src/contacts/confidence.test.ts
import { describe, it, expect } from 'vitest'
import { assignConfidence } from './confidence.js'

describe('assignConfidence', () => {
  it('CH contact with email is high', () => {
    expect(assignConfidence('companies_house', 'john@acme.co.uk', false)).toBe('high')
  })
  it('CH contact without email is medium', () => {
    expect(assignConfidence('companies_house', null, false)).toBe('medium')
  })
  it('KvK contact with email is high', () => {
    expect(assignConfidence('kvk', 'jan@bedrijf.nl', false)).toBe('high')
  })
  it('KvK contact without email is medium', () => {
    expect(assignConfidence('kvk', null, false)).toBe('medium')
  })
  it('press contact with email is high', () => {
    expect(assignConfidence('press', 'jane@co.uk', false)).toBe('high')
  })
  it('press contact without email is low', () => {
    expect(assignConfidence('press', null, false)).toBe('low')
  })
  it('website contact with SMTP verified email is high', () => {
    expect(assignConfidence('website', 'j@co.uk', true)).toBe('high')
  })
  it('website contact with unverified email is medium', () => {
    expect(assignConfidence('website', 'j@co.uk', false)).toBe('medium')
  })
  it('website contact without email is medium', () => {
    expect(assignConfidence('website', null, false)).toBe('medium')
  })
  it('google contact with SMTP verified email is medium', () => {
    expect(assignConfidence('google', 'j@co.uk', true)).toBe('medium')
  })
  it('google contact with unverified email is low', () => {
    expect(assignConfidence('google', 'j@co.uk', false)).toBe('low')
  })
  it('google contact without email is low', () => {
    expect(assignConfidence('google', null, false)).toBe('low')
  })
})
