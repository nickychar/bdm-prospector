// scraper/src/contacts/steps/website.ts
import * as cheerio from 'cheerio'
import { fetchHtml } from '../../scrapers/base.js'
import { mapTitleToPersona } from '../persona.js'
import type { FoundContact } from '../types.js'

const TEAM_PATH_KEYWORDS = [
  '/team', '/people', '/about', '/leadership', '/management',
  '/contact', '/over-ons', '/directie',
]

function isTeamLink(href: string): boolean {
  return TEAM_PATH_KEYWORDS.some(kw => href.toLowerCase().includes(kw))
}

const TARGET_TITLE_KEYWORDS = [
  'finance director', 'cfo', 'chief financial', 'hr director', 'operations director',
  'head of finance', 'head of talent', 'talent acquisition', 'hr business partner',
  'procurement', 'chief people', 'managing director', 'coo',
]

function looksLikeTargetTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return TARGET_TITLE_KEYWORDS.some(kw => lower.includes(kw))
}

function parseTeamPage(html: string): FoundContact[] {
  const $ = cheerio.load(html)
  const results: FoundContact[] = []

  $('h2, h3, h4').each((_, el) => {
    const name = $(el).text().trim()
    // Name heuristic: 2–4 words, each starting with a capital
    if (!/^[A-Z][a-z'-]+(?: [A-Za-z'-]+){1,3}$/.test(name)) return

    const titleText =
      $(el).next('p, span, div').first().text().trim() ||
      $(el).siblings('[class*="role"],[class*="title"],[class*="position"]').first().text().trim()

    if (!titleText || !looksLikeTargetTitle(titleText)) return

    results.push({
      name,
      title: titleText,
      personaType: mapTitleToPersona(titleText),
      source: 'website',
    })
  })

  return results
}

export async function findContactsOnWebsite(domain: string): Promise<FoundContact[]> {
  try {
    const homepage = await fetchHtml(`https://${domain}`)
    const $ = cheerio.load(homepage)
    const teamLinks: string[] = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (isTeamLink(href)) {
        const full = href.startsWith('http')
          ? href
          : `https://${domain}${href.startsWith('/') ? href : '/' + href}`
        if (!teamLinks.includes(full)) teamLinks.push(full)
      }
    })

    if (!teamLinks.length) return []

    const teamHtml = await fetchHtml(teamLinks[0])
    return parseTeamPage(teamHtml)
  } catch {
    return []
  }
}
