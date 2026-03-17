// scraper/src/contacts/email-patterns.test.ts
import { describe, it, expect } from 'vitest'
import { generateEmailPatterns, splitName } from './email-patterns.js'

describe('splitName', () => {
  it('splits "John Smith" into first and last', () => {
    expect(splitName('John Smith')).toEqual({ first: 'john', last: 'smith' })
  })
  it('uses first and last word for multi-word names', () => {
    expect(splitName('Mary Jane Watson')).toEqual({ first: 'mary', last: 'watson' })
  })
  it('handles single word name', () => {
    expect(splitName('Madonna')).toEqual({ first: 'madonna', last: '' })
  })
  it('lowercases output', () => {
    expect(splitName('JOHN SMITH')).toEqual({ first: 'john', last: 'smith' })
  })
  it('trims whitespace', () => {
    expect(splitName('  John Smith  ')).toEqual({ first: 'john', last: 'smith' })
  })
})

describe('generateEmailPatterns', () => {
  it('returns 5 patterns for a full name', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toHaveLength(5)
  })
  it('generates firstname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('john@example.com')
  })
  it('generates firstname.lastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('john.smith@example.com')
  })
  it('generates f.lastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('j.smith@example.com')
  })
  it('generates flastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('jsmith@example.com')
  })
  it('generates firstname_lastname@domain', () => {
    expect(generateEmailPatterns('john', 'smith', 'example.com')).toContain('john_smith@example.com')
  })
  it('returns empty array when last name is empty', () => {
    expect(generateEmailPatterns('madonna', '', 'example.com')).toHaveLength(0)
  })
  it('handles Dutch names correctly', () => {
    const patterns = generateEmailPatterns('jan', 'janssen', 'bedrijf.nl')
    expect(patterns).toContain('jan.janssen@bedrijf.nl')
  })
})
