-- ============================================================================
-- Appointments: calendar connections, appointment types, appointments, booking links
-- ============================================================================

-- ── Calendar Connections ────────────────────────────────────────────────────
-- Stores OAuth tokens for Google Calendar (and later Outlook) per user.
create table if not exists public.calendar_connections (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null default 'google', -- 'google' | 'outlook'
  email         text,                          -- the calendar owner's email
  access_token  text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id   text,                          -- primary calendar ID (e.g. 'primary')
  calendar_name text,                          -- display name of the calendar
  sync_enabled  boolean not null default true,
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);

-- ── Appointment Types ───────────────────────────────────────────────────────
-- Configurable meeting types that users offer to clients.
create table if not exists public.appointment_types (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  description   text,
  meeting_type  text not null default 'video', -- 'video' | 'phone' | 'in_person'
  duration_min  int not null default 30,
  color         text default '#6366f1',
  buffer_before_min int not null default 0,
  buffer_after_min  int not null default 0,
  -- Availability schedule (JSON): { "mon": [["09:00","17:00"]], ... }
  availability  jsonb not null default '{"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]],"wed":[["09:00","17:00"]],"thu":[["09:00","17:00"]],"fri":[["09:00","17:00"]],"sat":[],"sun":[]}'::jsonb,
  timezone      text not null default 'America/New_York',
  is_active     boolean not null default true,
  slug          text,                          -- URL slug for booking link
  min_notice_h  int not null default 2,        -- minimum hours before a slot
  max_days_ahead int not null default 30,      -- how far in advance clients can book
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Appointments ────────────────────────────────────────────────────────────
-- Individual booked appointments.
create table if not exists public.appointments (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  appointment_type_id uuid references public.appointment_types(id) on delete set null,
  user_id            uuid references auth.users(id) on delete set null, -- host
  contact_id         uuid references public.contacts(id) on delete set null,
  title              text not null,
  description        text,
  meeting_type       text not null default 'video', -- 'video' | 'phone' | 'in_person'
  status             text not null default 'confirmed', -- 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  start_time         timestamptz not null,
  end_time           timestamptz not null,
  location           text,                     -- physical address for in_person
  meeting_url        text,                     -- video call link
  phone_number       text,                     -- for phone appointments
  -- Google Calendar event ID for sync
  external_event_id  text,
  external_calendar_id text,
  -- Booking source
  booked_via_link    boolean not null default false,
  booking_link_id    uuid references public.appointment_types(id) on delete set null,
  -- Client info (if not a CRM contact)
  client_name        text,
  client_email       text,
  client_phone       text,
  -- Notes & follow-up
  notes              text,
  is_followup        boolean not null default false,
  parent_appointment_id uuid references public.appointments(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Booking Links ───────────────────────────────────────────────────────────
-- Public booking pages that show availability for one or more appointment types.
create table if not exists public.booking_links (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  slug          text not null,
  title         text not null,
  description   text,
  -- Which appointment types are available via this link
  appointment_type_ids uuid[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_calendar_conn_ws on public.calendar_connections(workspace_id);
create index if not exists idx_calendar_conn_user on public.calendar_connections(user_id);
create index if not exists idx_appt_types_ws on public.appointment_types(workspace_id);
create index if not exists idx_appt_types_slug on public.appointment_types(slug);
create index if not exists idx_appt_types_active on public.appointment_types(is_active);
create index if not exists idx_appointments_ws on public.appointments(workspace_id);
create index if not exists idx_appointments_user on public.appointments(user_id);
create index if not exists idx_appointments_contact on public.appointments(contact_id);
create index if not exists idx_appointments_start on public.appointments(start_time);
create index if not exists idx_appointments_status on public.appointments(status);
create index if not exists idx_appointments_type on public.appointments(appointment_type_id);
create index if not exists idx_booking_links_ws on public.booking_links(workspace_id);
create index if not exists idx_booking_links_slug on public.booking_links(slug);

-- ── RLS Policies ────────────────────────────────────────────────────────────

-- Calendar Connections: workspace members can manage their own connections
alter table public.calendar_connections enable row level security;

create policy "cc_select" on public.calendar_connections
  for select using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "cc_insert" on public.calendar_connections
  for insert with check (
    user_id = auth.uid() and
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "cc_update" on public.calendar_connections
  for update using (user_id = auth.uid());

create policy "cc_delete" on public.calendar_connections
  for delete using (user_id = auth.uid());

-- Appointment Types: workspace members can view, admins+ can manage
alter table public.appointment_types enable row level security;

create policy "at_select" on public.appointment_types
  for select using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "at_insert" on public.appointment_types
  for insert with check (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "at_update" on public.appointment_types
  for update using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "at_delete" on public.appointment_types
  for delete using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

-- Appointments: workspace members can view and manage
alter table public.appointments enable row level security;

create policy "ap_select" on public.appointments
  for select using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "ap_insert" on public.appointments
  for insert with check (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "ap_update" on public.appointments
  for update using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "ap_delete" on public.appointments
  for delete using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

-- Booking Links: workspace members can view and manage
alter table public.booking_links enable row level security;

create policy "bl_select" on public.booking_links
  for select using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "bl_insert" on public.booking_links
  for insert with check (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "bl_update" on public.booking_links
  for update using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

create policy "bl_delete" on public.booking_links
  for delete using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );
