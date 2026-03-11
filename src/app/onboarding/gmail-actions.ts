'use server'

import { redirect } from 'next/navigation'

const GMAIL_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

export async function connectGmail() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!clientId) {
    return { error: 'Google OAuth is not configured. Add GOOGLE_CLIENT_ID to .env.local.' }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/auth/gmail/callback`,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  })

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
