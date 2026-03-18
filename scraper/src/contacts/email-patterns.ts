// scraper/src/contacts/email-patterns.ts

export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().toLowerCase().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts[parts.length - 1] }
}

export function generateEmailPatterns(
  firstName: string,
  lastName: string,
  domain: string
): string[] {
  const f = firstName.toLowerCase().trim()
  const l = lastName.toLowerCase().trim()
  if (!f || !l) return []
  const fi = f[0]
  return [
    `${f}@${domain}`,
    `${f}.${l}@${domain}`,
    `${fi}.${l}@${domain}`,
    `${fi}${l}@${domain}`,
    `${f}_${l}@${domain}`,
  ]
}
