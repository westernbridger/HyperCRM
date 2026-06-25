'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUrl, getBusyTimes, createCalendarEvent, deleteCalendarEvent, refreshAccessToken } from '@/lib/google/calendar'

// ── Types ────────────────────────────────────────────────────────────────────

export type CalendarConnection = {
  id: string
  provider: string
  email: string | null
  calendar_id: string | null
  calendar_name: string | null
  sync_enabled: boolean
  last_synced_at: string | null
}

export type AppointmentType = {
  id: string
  workspace_id: string
  user_id: string | null
  name: string
  description: string | null
  meeting_type: 'video' | 'phone' | 'in_person'
  duration_min: number
  color: string | null
  buffer_before_min: number
  buffer_after_min: number
  availability: Record<string, string[][]>
  timezone: string
  is_active: boolean
  slug: string | null
  min_notice_h: number
  max_days_ahead: number
  created_at: string
  updated_at: string
}

export type Appointment = {
  id: string
  workspace_id: string
  appointment_type_id: string | null
  user_id: string | null
  contact_id: string | null
  title: string
  description: string | null
  meeting_type: 'video' | 'phone' | 'in_person'
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  start_time: string
  end_time: string
  location: string | null
  meeting_url: string | null
  phone_number: string | null
  external_event_id: string | null
  booked_via_link: boolean
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  notes: string | null
  is_followup: boolean
  parent_appointment_id: string | null
  created_at: string
  updated_at: string
  // Joined fields
  contact_name?: string | null
  contact_email?: string | null
  type_name?: string | null
  type_color?: string | null
}

export type BookingLink = {
  id: string
  workspace_id: string
  user_id: string | null
  slug: string
  title: string
  description: string | null
  appointment_type_ids: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const workspaceId = (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  return { supabase, workspaceId, userId: user?.id ?? null }
}

// ── Calendar Connection ──────────────────────────────────────────────────────

export async function getCalendarConnections(): Promise<{
  data: CalendarConnection[] | null
  error: string | null
}> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId || !userId) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (error) return { data: null, error: error.message }

  return { data: data as unknown as CalendarConnection[], error: null }
}

export async function connectGoogleCalendar(): Promise<{
  url: string | null
  error: string | null
}> {
  const { workspaceId, userId } = await getContext()
  if (!workspaceId || !userId) return { url: null, error: 'Not authenticated' }

  try {
    const state = `${workspaceId}:${userId}`
    const url = getAuthUrl(state)
    return { url, error: null }
  } catch (err: any) {
    return { url: null, error: err.message ?? 'Failed to generate auth URL' }
  }
}

export async function disconnectCalendar(connectionId: string): Promise<{
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('id', connectionId)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

// ── Appointment Types ────────────────────────────────────────────────────────

export async function getAppointmentTypes(): Promise<{
  data: AppointmentType[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  return { data: data as unknown as AppointmentType[], error: null }
}

export async function createAppointmentType(input: {
  name: string
  description?: string
  meeting_type?: 'video' | 'phone' | 'in_person'
  duration_min?: number
  color?: string
  buffer_before_min?: number
  buffer_after_min?: number
  availability?: Record<string, string[][]>
  timezone?: string
  min_notice_h?: number
  max_days_ahead?: number
}): Promise<{ data: AppointmentType | null; error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data, error } = await supabase
    .from('appointment_types')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      meeting_type: input.meeting_type ?? 'video',
      duration_min: input.duration_min ?? 30,
      color: input.color ?? '#6366f1',
      buffer_before_min: input.buffer_before_min ?? 0,
      buffer_after_min: input.buffer_after_min ?? 0,
      availability: input.availability ?? {
        mon: [['09:00', '17:00']],
        tue: [['09:00', '17:00']],
        wed: [['09:00', '17:00']],
        thu: [['09:00', '17:00']],
        fri: [['09:00', '17:00']],
        sat: [],
        sun: [],
      },
      timezone: input.timezone ?? 'America/New_York',
      slug,
      min_notice_h: input.min_notice_h ?? 2,
      max_days_ahead: input.max_days_ahead ?? 30,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  return { data: data as unknown as AppointmentType, error: null }
}

export async function updateAppointmentType(
  id: string,
  updates: Partial<AppointmentType>
): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('appointment_types')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

export async function deleteAppointmentType(id: string): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('appointment_types')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

// ── Appointments ─────────────────────────────────────────────────────────────

export async function getAppointments(opts?: {
  startDate?: string
  endDate?: string
  status?: string
}): Promise<{ data: Appointment[] | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  let query = supabase
    .from('appointments')
    .select(`
      *,
      contact:contacts(first_name, last_name, email),
      type:appointment_types(name, color)
    `)
    .eq('workspace_id', workspaceId)
    .order('start_time', { ascending: true })

  if (opts?.startDate) query = query.gte('start_time', opts.startDate)
  if (opts?.endDate) query = query.lte('start_time', opts.endDate)
  if (opts?.status) query = query.eq('status', opts.status)

  const { data, error } = await query

  if (error) return { data: null, error: error.message }

  const appointments = (data ?? []).map((row: any) => ({
    ...row,
    contact_name: row.contact
      ? `${row.contact.first_name} ${row.contact.last_name}`.trim()
      : row.client_name,
    contact_email: row.contact?.email ?? row.client_email,
    type_name: row.type?.name,
    type_color: row.type?.color,
  })) as Appointment[]

  return { data: appointments, error: null }
}

export async function createAppointment(input: {
  appointment_type_id?: string | null
  contact_id?: string | null
  title: string
  description?: string
  meeting_type?: 'video' | 'phone' | 'in_person'
  start_time: string
  end_time: string
  location?: string
  meeting_url?: string
  phone_number?: string
  client_name?: string
  client_email?: string
  client_phone?: string
  notes?: string
  is_followup?: boolean
  parent_appointment_id?: string | null
}): Promise<{ data: Appointment | null; error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  // Insert appointment
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      workspace_id: workspaceId,
      appointment_type_id: input.appointment_type_id ?? null,
      user_id: userId,
      contact_id: input.contact_id ?? null,
      title: input.title,
      description: input.description ?? null,
      meeting_type: input.meeting_type ?? 'video',
      status: 'confirmed',
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location ?? null,
      meeting_url: input.meeting_url ?? null,
      phone_number: input.phone_number ?? null,
      client_name: input.client_name ?? null,
      client_email: input.client_email ?? null,
      client_phone: input.client_phone ?? null,
      notes: input.notes ?? null,
      is_followup: input.is_followup ?? false,
      parent_appointment_id: input.parent_appointment_id ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  const appointment = data as unknown as Appointment

  // Try to sync to Google Calendar
  try {
    const { data: conn } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId!)
      .eq('provider', 'google')
      .eq('sync_enabled', true)
      .maybeSingle()

    if (conn) {
      // Refresh token if needed
      let accessToken = conn.access_token
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshed = await refreshAccessToken(conn.refresh_token!)
        accessToken = refreshed.access_token ?? null
        await supabase
          .from('calendar_connections')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: refreshed.expiry_date
              ? new Date(refreshed.expiry_date).toISOString()
              : null,
          })
          .eq('id', conn.id)
      }

      const eventId = await createCalendarEvent(
        accessToken!,
        conn.refresh_token ?? undefined,
        conn.calendar_id ?? 'primary',
        {
          summary: input.title,
          description: input.description,
          start: input.start_time,
          end: input.end_time,
          location: input.location ?? input.meeting_url,
          attendees: input.client_email
            ? [{ email: input.client_email, name: input.client_name ?? undefined }]
            : undefined,
        }
      )

      if (eventId) {
        await supabase
          .from('appointments')
          .update({ external_event_id: eventId, external_calendar_id: conn.calendar_id })
          .eq('id', appointment.id)
      }
    }
  } catch (syncErr) {
    console.error('Calendar sync error (non-fatal):', syncErr)
  }

  return { data: appointment, error: null }
}

export async function updateAppointmentStatus(
  id: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
): Promise<{ error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  // If cancelling, try to delete from Google Calendar
  if (status === 'cancelled' && !error) {
    const { data: appt } = await supabase
      .from('appointments')
      .select('external_event_id, external_calendar_id')
      .eq('id', id)
      .single()

    if (appt?.external_event_id && appt?.external_calendar_id) {
      const { data: conn } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId!)
        .eq('provider', 'google')
        .maybeSingle()

      if (conn?.access_token) {
        try {
          await deleteCalendarEvent(
            conn.access_token,
            conn.refresh_token ?? undefined,
            appt.external_calendar_id,
            appt.external_event_id
          )
        } catch (e) {
          console.error('Failed to delete calendar event:', e)
        }
      }
    }
  }

  return { error: error?.message ?? null }
}

export async function deleteAppointment(id: string): Promise<{ error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { error: 'Not authenticated' }

  // Try to delete from Google Calendar first
  const { data: appt } = await supabase
    .from('appointments')
    .select('external_event_id, external_calendar_id')
    .eq('id', id)
    .single()

  if (appt?.external_event_id && appt?.external_calendar_id) {
    const { data: conn } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId!)
      .eq('provider', 'google')
      .maybeSingle()

    if (conn?.access_token) {
      try {
        await deleteCalendarEvent(
          conn.access_token,
          conn.refresh_token ?? undefined,
          appt.external_calendar_id,
          appt.external_event_id
        )
      } catch (e) {
        console.error('Failed to delete calendar event:', e)
      }
    }
  }

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

// ── Availability: get free slots for a date range ────────────────────────────

export async function getAvailableSlots(
  appointmentTypeId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { start: string; end: string }[] | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  // Get appointment type
  const { data: apptType } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('id', appointmentTypeId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!apptType) return { data: null, error: 'Appointment type not found' }

  // Get calendar connection for busy times
  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google')
    .eq('sync_enabled', true)
    .maybeSingle()

  // Get existing appointments in range
  const { data: existingAppts } = await supabase
    .from('appointments')
    .select('start_time, end_time, status')
    .eq('workspace_id', workspaceId)
    .gte('start_time', dateFrom)
    .lte('start_time', dateTo)
    .neq('status', 'cancelled')

  // Build busy intervals
  const busyIntervals: { start: string; end: string }[] = []

  // Add existing appointments as busy
  for (const appt of existingAppts ?? []) {
    busyIntervals.push({ start: appt.start_time, end: appt.end_time })
  }

  // Add Google Calendar busy times
  if (conn?.access_token && conn?.calendar_id) {
    try {
      let accessToken: string | null = conn.access_token
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshed = await refreshAccessToken(conn.refresh_token!)
        accessToken = refreshed.access_token ?? null
      }
      const googleBusy = await getBusyTimes(
        accessToken!,
        conn.refresh_token ?? undefined,
        conn.calendar_id,
        dateFrom,
        dateTo
      )
      busyIntervals.push(...googleBusy)
    } catch (e) {
      console.error('Failed to get Google busy times:', e)
    }
  }

  // Generate available slots based on availability schedule
  const availability = apptType.availability as Record<string, string[][]>
  const durationMin = apptType.duration_min
  const bufferBefore = apptType.buffer_before_min
  const bufferAfter = apptType.buffer_after_min
  const minNoticeMs = apptType.min_notice_h * 60 * 60 * 1000
  const maxAheadMs = apptType.max_days_ahead * 24 * 60 * 60 * 1000

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const slots: { start: string; end: string }[] = []

  const fromDate = new Date(dateFrom)
  const toDate = new Date(dateTo)
  const now = new Date()
  const maxDate = new Date(now.getTime() + maxAheadMs)

  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    if (d > maxDate) break
    if (d.getTime() < now.getTime() + minNoticeMs) continue

    const dayName = dayNames[d.getDay()]
    const dayRanges = availability[dayName] ?? []

    for (const range of dayRanges) {
      const [rangeStart, rangeEnd] = range
      const [startH, startM] = rangeStart.split(':').map(Number)
      const [endH, endM] = rangeEnd.split(':').map(Number)

      const slotStart = new Date(d)
      slotStart.setHours(startH, startM, 0, 0)

      const rangeEndTime = new Date(d)
      rangeEndTime.setHours(endH, endM, 0, 0)

      // Generate slots
      let current = new Date(slotStart)
      while (current.getTime() + durationMin * 60 * 1000 <= rangeEndTime.getTime()) {
        const slotEnd = new Date(current.getTime() + durationMin * 60 * 1000)

        // Apply buffer
        const busyStart = new Date(current.getTime() - bufferBefore * 60 * 1000)
        const busyEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000)

        // Check if slot conflicts with any busy interval
        const hasConflict = busyIntervals.some((b) => {
          const bStart = new Date(b.start)
          const bEnd = new Date(b.end)
          return (
            (busyStart >= bStart && busyStart < bEnd) ||
            (busyEnd > bStart && busyEnd <= bEnd) ||
            (busyStart <= bStart && busyEnd >= bEnd)
          )
        })

        // Check minimum notice
        const passesNotice = current.getTime() >= now.getTime() + minNoticeMs

        if (!hasConflict && passesNotice) {
          slots.push({
            start: current.toISOString(),
            end: slotEnd.toISOString(),
          })
        }

        // Move to next slot (15-min increments)
        current = new Date(current.getTime() + 15 * 60 * 1000)
      }
    }
  }

  return { data: slots, error: null }
}

// ── Booking Links ────────────────────────────────────────────────────────────

export async function getBookingLinks(): Promise<{
  data: BookingLink[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('booking_links')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  return { data: data as unknown as BookingLink[], error: null }
}

export async function createBookingLink(input: {
  title: string
  description?: string
  appointment_type_ids: string[]
}): Promise<{ data: BookingLink | null; error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { data: null, error: 'Not authenticated' }

  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)

  const { data, error } = await supabase
    .from('booking_links')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      slug,
      title: input.title,
      description: input.description ?? null,
      appointment_type_ids: input.appointment_type_ids,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  return { data: data as unknown as BookingLink, error: null }
}

export async function deleteBookingLink(id: string): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('booking_links')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

// ── Public booking: get appointment type by slug (no auth) ───────────────────

export async function getAppointmentTypeBySlug(
  slug: string
): Promise<{ data: AppointmentType | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'Appointment type not found' }

  return { data: data as unknown as AppointmentType, error: null }
}

export async function bookAppointmentByLink(
  slug: string,
  input: {
    start_time: string
    end_time: string
    client_name: string
    client_email: string
    client_phone?: string
  }
): Promise<{ data: Appointment | null; error: string | null }> {
  const supabase = await createClient()

  // Get appointment type
  const { data: apptType, error: typeError } = await getAppointmentTypeBySlug(slug)
  if (typeError || !apptType) {
    return { data: null, error: typeError ?? 'Appointment type not found' }
  }

  // Check for double booking
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('workspace_id', apptType.workspace_id)
    .neq('status', 'cancelled')
    .or(`and(start_time.lt.${input.end_time},end_time.gt.${input.start_time})`)
    .maybeSingle()

  if (conflicts) {
    return { data: null, error: 'This time slot is no longer available. Please choose another time.' }
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      workspace_id: apptType.workspace_id,
      appointment_type_id: apptType.id,
      user_id: apptType.user_id,
      title: `${apptType.name} with ${input.client_name}`,
      meeting_type: apptType.meeting_type,
      status: 'confirmed',
      start_time: input.start_time,
      end_time: input.end_time,
      booked_via_link: true,
      booking_link_id: apptType.id,
      client_name: input.client_name,
      client_email: input.client_email,
      client_phone: input.client_phone ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  // Try to sync to Google Calendar
  try {
    const { data: conn } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('workspace_id', apptType.workspace_id)
      .eq('user_id', apptType.user_id!)
      .eq('provider', 'google')
      .eq('sync_enabled', true)
      .maybeSingle()

    if (conn?.access_token) {
      let accessToken: string | null = conn.access_token
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshed = await refreshAccessToken(conn.refresh_token!)
        accessToken = refreshed.access_token ?? null
      }

      const eventId = await createCalendarEvent(
        accessToken!,
        conn.refresh_token ?? undefined,
        conn.calendar_id ?? 'primary',
        {
          summary: `${apptType.name} with ${input.client_name}`,
          start: input.start_time,
          end: input.end_time,
          attendees: [{ email: input.client_email, name: input.client_name }],
        }
      )

      if (eventId) {
        await supabase
          .from('appointments')
          .update({ external_event_id: eventId, external_calendar_id: conn.calendar_id })
          .eq('id', (data as any).id)
      }
    }
  } catch (e) {
    console.error('Calendar sync error (non-fatal):', e)
  }

  return { data: data as unknown as Appointment, error: null }
}
