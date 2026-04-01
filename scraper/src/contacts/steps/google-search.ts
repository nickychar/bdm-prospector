// scraper/src/contacts/steps/google-search.ts
// Finds HR contacts via Google search (LinkedIn profiles + press releases)
// Uses Google search snippets — no LinkedIn login required
import { fetch } from 'undici'
import type { FoundContact } from '../types.js'
import { mapTitleToPersona } from '../persona.js'

const GOOGLE_SEARCH_URL = 'https://www.google.com/search'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
}

const HR_TITLE_KEYWORDS = [
  'hr director', 'head of hr', 'human resources', 'talent acquisition',
  'hr manager', 'people director', 'chief people', 'recruitment manager',
  'hiring manager', 'hr business partner', 'vp people', 'vp hr',
]

function extractNameAndTitle(snippet: string): { name: string; title: string } | null {
  // Match "Name - Title at Company" or "Name | Title" patterns from LinkedIn snippets
  const patterns = [
    /^([A-Z][a-z]+(?: [A-Z][a-z''-]+){1,3})\s*[-–|]\s*([^·•\n]+)/,
    /^([A-Z][a-z]+(?: [A-Z][a-z''-]+){1,3})\s*·\s*([^·\n]+)/,
  ]
  for (const pattern of patterns) {
    const match = snippet.match(pattern)
    if (match) {
      const name = match[1].trim()
      const title = match[2].trim().split(' at ')[0].trim()
      if (HR_TITLE_KEYWORDS.some(kw => title.toLowerCase().includes(kw))) {
        return { name, title }
      }
    }
  }
  return null
}

async function googleSearch(query: string): Promise<string[]> {
  try {
    const url = `${GOOGLE_SEARCH_URL}?q=${encodeURIComponent(query)}&num=10&hl=nl`
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    const html = await res.text()

    // Extract text snippets from Google results
    const snippets: string[] = []
    const spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/g
    let match
    while ((match = spanRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim()
      if (text.length > 20 && text.length < 300) snippets.push(text)
    }
    return snippets
  } catch {
    return []
  }
}

export async function searchLinkedInContacts(companyName: string): Promise<FoundContact[]> {
  const query = `"${companyName}" HR director OR "head of HR" OR "talent acquisition" site:linkedin.com/in`
  const snippets = await googleSearch(query)
  const contacts: FoundContact[] = []

  for (const snippet of snippets) {
    const extracted = extractNameAndTitle(snippet)
    if (extracted) {
      contacts.push({
        name: extracted.name,
        title: extracted.title,
        source: 'google',
        personaType: mapTitleToPersona(extracted.title),
      })
    }
  }

  return contacts
}

export async function searchPressReleases(companyName: string): Promise<FoundContact[]> {
  const query = `"${companyName}" benoemd OR aangesteld OR "nieuw hoofd" HR OR "human resources" OR "people"`
  const snippets = await googleSearch(query)
  const contacts: FoundContact[] = []

  for (const snippet of snippets) {
    const extracted = extractNameAndTitle(snippet)
    if (extracted) {
      contacts.push({
        name: extracted.name,
        title: extracted.title,
        source: 'press',
        personaType: mapTitleToPersona(extracted.title),
      })
    }
  }

  return contacts
}
