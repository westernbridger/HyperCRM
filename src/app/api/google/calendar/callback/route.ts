import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getPrimaryCalendar } from '@/lib/google/calendar'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/appointments?error=oauth_denied', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/appointments?error=oauth_failed', request.url))
  }

  try {
    // State is "workspaceId:userId"
    const [workspaceId, userId] = state.split(':')
    if (!workspaceId || !userId) {
      return NextResponse.redirect(new URL('/appointments?error=invalid_state', request.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/appointments?error=no_tokens', request.url))
    }

    // Get primary calendar info
    const primaryCal = await getPrimaryCalendar(tokens.access_token, tokens.refresh_token)

    // Store in database
    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from('calendar_connections')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        provider: 'google',
        email: primaryCal?.id ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        calendar_id: primaryCal?.id ?? 'primary',
        calendar_name: primaryCal?.summary ?? 'My Calendar',
        sync_enabled: true,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,user_id,provider',
      })

    if (dbError) {
      console.error('DB error saving calendar connection:', dbError)
      const dbMsg = encodeURIComponent(dbError.message || JSON.stringify(dbError))
      return NextResponse.redirect(new URL(`/appointments?error=db_error&detail=${dbMsg}`, request.url))
    }

    return NextResponse.redirect(new URL('/appointments?connected=google', request.url))
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    const encoded = encodeURIComponent(msg)
    return NextResponse.redirect(new URL(`/appointments?error=callback_exception&detail=${encoded}`, request.url))
  }
}
