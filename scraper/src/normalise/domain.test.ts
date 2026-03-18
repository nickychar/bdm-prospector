import { describe, it, expect } from 'vitest'
import { normaliseDomain, extractDomainFromUrl } from './domain.js'

describe('normaliseDomain', () => {
  it('strips www prefix', () => { expect(normaliseDomain('www.example.com')).toBe('example.com') })
  it('lowercases the domain', () => { expect(normaliseDomain('EXAMPLE.CO.UK')).toBe('example.co.uk') })
  it('strips www and lowercases together', () => { expect(normaliseDomain('WWW.Acme.co.uk')).toBe('acme.co.uk') })
  it('keeps country TLD intact', () => { expect(normaliseDomain('www.bedrijf.nl')).toBe('bedrijf.nl') })
  it('handles domain already clean', () => { expect(normaliseDomain('example.com')).toBe('example.com') })
  it('trims whitespace', () => { expect(normaliseDomain('  example.com  ')).toBe('example.com') })
})

describe('extractDomainFromUrl', () => {
  it('extracts domain from full URL', () => { expect(extractDomainFromUrl('https://www.acme.co.uk/careers')).toBe('acme.co.uk') })
  it('extracts domain from URL without path', () => { expect(extractDomainFromUrl('https://example.nl')).toBe('example.nl') })
  it('returns null for invalid URL', () => { expect(extractDomainFromUrl('not a url')).toBeNull() })
  it('returns null for empty string', () => { expect(extractDomainFromUrl('')).toBeNull() })
  it('handles URLs with ports', () => { expect(extractDomainFromUrl('https://example.com:8080/path')).toBe('example.com') })
})
