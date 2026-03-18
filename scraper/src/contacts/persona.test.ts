// scraper/src/contacts/persona.test.ts
import { describe, it, expect } from 'vitest'
import { mapTitleToPersona } from './persona.js'

describe('mapTitleToPersona', () => {
  it('maps Finance Director to hiring_manager', () => {
    expect(mapTitleToPersona('Finance Director')).toBe('hiring_manager')
  })
  it('maps CFO to hiring_manager', () => {
    expect(mapTitleToPersona('CFO')).toBe('hiring_manager')
  })
  it('maps Chief Financial Officer to hiring_manager', () => {
    expect(mapTitleToPersona('Chief Financial Officer')).toBe('hiring_manager')
  })
  it('maps HR Director to hiring_manager', () => {
    expect(mapTitleToPersona('HR Director')).toBe('hiring_manager')
  })
  it('maps Operations Director to hiring_manager', () => {
    expect(mapTitleToPersona('Operations Director')).toBe('hiring_manager')
  })
  it('maps Head of Talent to agency_selector', () => {
    expect(mapTitleToPersona('Head of Talent')).toBe('agency_selector')
  })
  it('maps Talent Acquisition Manager to agency_selector', () => {
    expect(mapTitleToPersona('Talent Acquisition Manager')).toBe('agency_selector')
  })
  it('maps HR Business Partner to agency_selector', () => {
    expect(mapTitleToPersona('HR Business Partner')).toBe('agency_selector')
  })
  it('maps Procurement Director to agency_selector', () => {
    expect(mapTitleToPersona('Procurement Director')).toBe('agency_selector')
  })
  it('maps Chief People Officer to agency_selector', () => {
    expect(mapTitleToPersona('Chief People Officer')).toBe('agency_selector')
  })
  it('is case-insensitive', () => {
    expect(mapTitleToPersona('FINANCE DIRECTOR')).toBe('hiring_manager')
    expect(mapTitleToPersona('head of talent')).toBe('agency_selector')
  })
  it('defaults to hiring_manager for Managing Director', () => {
    expect(mapTitleToPersona('Managing Director')).toBe('hiring_manager')
  })
  it('maps Head of People to agency_selector', () => {
    expect(mapTitleToPersona('Head of People')).toBe('agency_selector')
  })
})
