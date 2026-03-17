import { describe, it, expect } from 'vitest'
import { PIPELINE_STAGES, STAGE_LABELS } from './types'

describe('types', () => {
  it('has 7 pipeline stages', () => {
    expect(PIPELINE_STAGES).toHaveLength(7)
  })

  it('has a label for every stage', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(STAGE_LABELS[stage]).toBeTruthy()
    })
  })
})
