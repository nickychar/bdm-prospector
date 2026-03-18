import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/onboarding?error=gmail_denied`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin

  // Exchange auth code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/auth/gmail/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/onboarding?error=gmail_token_failed`)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  // Store tokens in crm_connections
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  const { error: upsertError } = await supabase
    .from('crm_connections')
    .upsert({
      user_id: user.id,
      provider: 'gmail',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

  if (upsertError) {
    return NextResponse.redirect(`${origin}/onboarding?error=gmail_save_failed`)
  }

  return NextResponse.redirect(`${origin}/onboarding`)
}
