import { describe, it, expect } from 'vitest'
import { getScoreBand } from './score-band.js'

describe('getScoreBand', () => {
  it('100 → hot', () => { expect(getScoreBand(100)).toBe('hot') })
  it('70 → hot (lower boundary)', () => { expect(getScoreBand(70)).toBe('hot') })
  it('69 → warm', () => { expect(getScoreBand(69)).toBe('warm') })
  it('45 → warm (lower boundary)', () => { expect(getScoreBand(45)).toBe('warm') })
  it('44 → cold', () => { expect(getScoreBand(44)).toBe('cold') })
  it('20 → cold (lower boundary)', () => { expect(getScoreBand(20)).toBe('cold') })
  it('19 → hidden', () => { expect(getScoreBand(19)).toBe('hidden') })
  it('0 → hidden', () => { expect(getScoreBand(0)).toBe('hidden') })
})
