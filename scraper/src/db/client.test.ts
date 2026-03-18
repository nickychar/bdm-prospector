import { describe, it, expect } from 'vitest'
import { db } from './client.js'

describe('db client', () => {
  it('connects and can query scrape_jobs', async () => {
    const { error } = await db.from('scrape_jobs').select('id').limit(1)
    expect(error).toBeNull()
  })
})
