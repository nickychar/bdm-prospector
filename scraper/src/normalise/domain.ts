export function normaliseDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '')
}

export function extractDomainFromUrl(url: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return normaliseDomain(parsed.hostname)
  } catch {
    return null
  }
}
