import { google } from 'googleapis'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Google OAuth env vars. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.'
    )
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(state: string): string {
  const client = getGoogleOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = getGoogleOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function refreshAccessToken(refreshToken: string) {
  const client = getGoogleOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  return credentials
}

export async function getCalendarClient(accessToken: string, refreshToken?: string) {
  const client = getGoogleOAuthClient()
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return google.calendar({ version: 'v3', auth: client })
}

// Get the user's primary calendar
export async function getPrimaryCalendar(accessToken: string, refreshToken?: string) {
  const calendar = await getCalendarClient(accessToken, refreshToken)
  const { data } = await calendar.calendarList.list()
  const primary = data.items?.find((c) => c.primary) ?? data.items?.[0]
  return primary
}

// Get busy/free intervals from Google Calendar for a date range
export async function getBusyTimes(
  accessToken: string,
  refreshToken: string | undefined,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const calendar = await getCalendarClient(accessToken, refreshToken)
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    },
  })

  const busy = data.calendars?.[calendarId]?.busy ?? []
  return busy.map((b) => ({ start: b.start ?? '', end: b.end ?? '' }))
}

// Create a Google Calendar event and return its ID + Meet URL
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string | undefined,
  calendarId: string,
  event: {
    summary: string
    description?: string
    start: string
    end: string
    location?: string
    attendees?: { email: string; name?: string }[]
    generateMeet?: boolean
  }
): Promise<{ eventId: string | null; meetUrl: string | null }> {
  const calendar = await getCalendarClient(accessToken, refreshToken)
  const { data } = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
      location: event.location,
      attendees: event.attendees,
      reminders: {
        useDefault: true,
      },
      ...(event.generateMeet
        ? {
            conferenceData: {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }
        : {}),
    },
  })

  const meetUrl =
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? null

  return { eventId: data.id ?? null, meetUrl }
}

// Delete a Google Calendar event
export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string | undefined,
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = await getCalendarClient(accessToken, refreshToken)
  await calendar.events.delete({ calendarId, eventId })
}
