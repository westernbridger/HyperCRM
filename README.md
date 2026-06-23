# HyperCRM

A multi-tenant CRM SaaS built with Next.js (App Router), Supabase (Postgres + Auth + RLS), TanStack Query, and Tailwind. Includes a Meta (Facebook/Instagram) Lead Ads webhook that ingests leads directly into the pipeline.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions)
- **Database/Auth**: Supabase (Postgres, Row-Level Security, multi-workspace membership)
- **Data fetching**: TanStack Query (client cache + optimistic updates)
- **UI**: Tailwind CSS, base-ui/Radix components, Framer Motion, dnd-kit (pipeline board)
- **Email**: Resend

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment Variables

Create `.env.local` (see `src/lib/env.ts` for validation):

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key (server only — webhook/admin) |
| `META_VERIFY_TOKEN` | webhook | Token used during Meta webhook subscription handshake |
| `META_APP_SECRET` | webhook | Meta app secret — verifies `X-Hub-Signature-256` payload signatures |
| `CRON_SECRET` | retry | Bearer secret protecting the webhook retry endpoint |
| `RESEND_API_KEY` | email | Resend API key |
| `RESEND_FROM_EMAIL` | email | From address for transactional email |
| `NEXT_PUBLIC_APP_URL` | no | App base URL (defaults to localhost) |

## Database Setup

Run the SQL files in `supabase/` in the Supabase SQL Editor, in this order:

1. `schema.sql` — core tables, RLS, signup trigger
2. `multi-workspace.sql` — `workspace_members` + multi-workspace RLS
3. `team-invitations.sql` — invitations
4. `notifications.sql` — notifications
5. `meta-integrations.sql` — Meta page tokens per workspace
6. `webhook-retry-queue.sql` — failed-lead retry queue
7. `performance-indexes.sql` — composite/GIN indexes for hot query paths

The various `fix-*.sql` files are historical RLS patches; apply only if migrating an older instance.

> **Note on types**: `src/lib/supabase/database.types.ts` is hand-maintained. Each table **must** include a `Relationships` field or the typed Supabase client degrades every table to `never`. Keep it in sync when you change the schema (or regenerate with `supabase gen types typescript`).

## Meta Lead Ads Webhook

### Endpoints

**`GET /api/webhooks/meta`** — Subscription verification.
Meta sends `hub.mode`, `hub.verify_token`, `hub.challenge`; the handler echoes the challenge when the token matches `META_VERIFY_TOKEN`.

**`POST /api/webhooks/meta`** — Lead delivery.
- Verifies the `X-Hub-Signature-256` HMAC-SHA256 of the raw body against `META_APP_SECRET` (rejects unsigned/forged payloads with `403`).
- For each `leadgen` change, fetches the full lead from the Graph API using the page token in `meta_integrations`, then creates/updates a `Contact` (status `Lead`) and logs an activity.
- Failures are routed to the `meta_webhook_failures` queue: transient errors (5xx, 429, expired token `190`, network/DB) are retried with exponential backoff; config errors (missing integration) are not.

**`POST /api/webhooks/meta/retry`** — Re-processes due queue entries.
Requires `Authorization: Bearer <CRON_SECRET>`. Wire to a scheduler (e.g. Vercel Cron) to drain the retry queue periodically.

### Connecting a Page (one-time)

1. In Graph API Explorer, generate a token with `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `leads_retrieval` (requires the **Marketing API** product added to the app).
2. `GET /me/accounts` → copy the target page's `access_token`.
3. `POST /{page_id}/subscribed_apps` with `subscribed_fields=leadgen` using the **page** token.
4. Insert the page token into `meta_integrations` for the workspace.
5. Test via the [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing).

## Project Structure

```
src/
├── app/
│   ├── api/webhooks/meta/      # Meta webhook + retry endpoints
│   ├── actions/                # Server Actions (contacts, workspaces, ...)
│   ├── leads/                  # Pipeline board page
│   ├── contacts/               # Contacts table + detail
│   ├── error.tsx loading.tsx   # Route-level boundaries
│   └── global-error.tsx        # Root-layout error boundary
├── components/
│   ├── providers/              # TanStack Query provider
│   ├── leads/                  # Pipeline board (dnd-kit)
│   └── ui/                     # Design system primitives
├── hooks/                      # use-contacts (React Query), use-toast
└── lib/
    ├── env.ts                  # Env validation (server-only)
    ├── meta/process-lead.ts    # Lead ingestion + retry queue logic
    └── supabase/               # client/server/admin + database.types.ts
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build (type errors fail the build)
- `npm run start` — serve production build
- `npm run lint` — ESLint

## Deployment

Deploy on Vercel. Set all environment variables in the project settings, and add a Cron entry hitting `/api/webhooks/meta/retry` (with `CRON_SECRET`) to drain the lead retry queue.
