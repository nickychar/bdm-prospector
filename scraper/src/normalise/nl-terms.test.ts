import { describe, it, expect } from 'vitest'
import { normaliseContractType, normaliseSeniority } from './nl-terms.js'

describe('normaliseContractType', () => {
  it('maps "detachering" to interim', () => { expect(normaliseContractType('detachering')).toBe('interim') })
  it('maps "interim" to interim', () => { expect(normaliseContractType('interim')).toBe('interim') })
  it('maps "flex" to interim', () => { expect(normaliseContractType('flex')).toBe('interim') })
  it('maps "tijdelijk" to temp', () => { expect(normaliseContractType('tijdelijk')).toBe('temp') })
  it('maps "temporary" (English) to temp', () => { expect(normaliseContractType('temporary')).toBe('temp') })
  it('maps "contract" (English) to contract', () => { expect(normaliseContractType('contract')).toBe('contract') })
  it('maps "vast" to permanent (to be filtered out)', () => { expect(normaliseContractType('vast')).toBe('permanent') })
  it('maps "fulltime" to permanent (not interim)', () => { expect(normaliseContractType('fulltime')).toBe('permanent') })
  it('returns "other" for unknown term', () => { expect(normaliseContractType('stageplaats')).toBe('other') })
  it('is case-insensitive', () => {
    expect(normaliseContractType('DETACHERING')).toBe('interim')
    expect(normaliseContractType('Tijdelijk')).toBe('temp')
  })
  it('trims whitespace', () => { expect(normaliseContractType('  interim  ')).toBe('interim') })
})

describe('normaliseSeniority', () => {
  it('maps "directeur" to director', () => { expect(normaliseSeniority('directeur')).toBe('director') })
  it('maps "director" (English) to director', () => { expect(normaliseSeniority('director')).toBe('director') })
  it('maps "hoofd" to head', () => { expect(normaliseSeniority('hoofd')).toBe('head') })
  it('maps "head of" (English) to head', () => { expect(normaliseSeniority('head of')).toBe('head') })
  it('maps "manager" to manager', () => { expect(normaliseSeniority('manager')).toBe('manager') })
  it('maps "senior" to manager (treated as manager-level)', () => { expect(normaliseSeniority('senior')).toBe('manager') })
  it('returns "other" for unknown term', () => { expect(normaliseSeniority('medewerker')).toBe('other') })
  it('is case-insensitive', () => { expect(normaliseSeniority('DIRECTEUR')).toBe('director') })
})
