// scraper/src/contacts/steps/website.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../scrapers/base.js', () => ({ fetchHtml: vi.fn() }))

import { findContactsOnWebsite } from './website.js'
import { fetchHtml } from '../../scrapers/base.js'

const HOMEPAGE_HTML = `
  <html><body>
    <nav>
      <a href="/about-us">About</a>
      <a href="/our-team">Our Team</a>
      <a href="/contact">Contact</a>
    </nav>
  </body></html>
`
const TEAM_PAGE_HTML = `
  <html><body>
    <div class="team-member">
      <h3>Sarah Brown</h3>
      <p class="role">Chief Financial Officer</p>
    </div>
    <div class="team-member">
      <h3>Mark Taylor</h3>
      <p class="role">Head of Talent Acquisition</p>
    </div>
  </body></html>
`

describe('findContactsOnWebsite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches homepage then follows the first team-related link', async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce(HOMEPAGE_HTML)
      .mockResolvedValueOnce(TEAM_PAGE_HTML)
    await findContactsOnWebsite('acme.co.uk')
    expect(fetchHtml).toHaveBeenCalledTimes(2)
  })

  it('returns contacts found on team page', async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce(HOMEPAGE_HTML)
      .mockResolvedValueOnce(TEAM_PAGE_HTML)
    const contacts = await findContactsOnWebsite('acme.co.uk')
    expect(contacts.length).toBeGreaterThan(0)
    expect(contacts[0].source).toBe('website')
  })

  it('returns empty on fetch error', async () => {
    vi.mocked(fetchHtml).mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await findContactsOnWebsite('acme.co.uk')).toEqual([])
  })

  it('returns empty when no team-related links on homepage', async () => {
    vi.mocked(fetchHtml).mockResolvedValue(
      '<html><body><a href="/products">Products</a></body></html>'
    )
    expect(await findContactsOnWebsite('acme.co.uk')).toEqual([])
  })

  it('returns empty for homepage with no links', async () => {
    vi.mocked(fetchHtml).mockResolvedValue('<html><body><p>No navigation</p></body></html>')
    expect(await findContactsOnWebsite('acme.co.uk')).toEqual([])
  })

  it('constructs correct URL for relative href without leading slash', async () => {
    // href="about/team" matches isTeamLink (contains "/team") but has no leading slash.
    // Should become https://acme.co.uk/about/team, not https://acme.co.ukabout/team
    const homepageWithBareRelativeHref = `
      <html><body>
        <a href="about/team">Team</a>
      </body></html>
    `
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce(homepageWithBareRelativeHref)
      .mockResolvedValueOnce(TEAM_PAGE_HTML)
    await findContactsOnWebsite('acme.co.uk')
    expect(fetchHtml).toHaveBeenCalledWith('https://acme.co.uk/about/team')
  })
})
