-- ============================================================
-- HyperCRM — Meta Webhook Failure Queue
-- Run in Supabase Dashboard -> SQL Editor.
--
-- When the Meta webhook can't process a lead (e.g. the Graph API is briefly
-- unavailable, or the page access token needs refreshing) we persist the
-- leadgen_id here instead of dropping the lead. A scheduled job (or the
-- /api/webhooks/meta/retry endpoint) re-processes pending rows with backoff.
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_webhook_failures (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  leadgen_id    text        NOT NULL,
  page_id       text,
  attempts      integer     NOT NULL DEFAULT 1,
  last_error    text,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  resolved      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One row per lead; re-failures update the existing row's attempt count.
  UNIQUE (leadgen_id)
);

-- Worker query: fetch unresolved rows whose backoff window has elapsed.
CREATE INDEX IF NOT EXISTS idx_meta_webhook_failures_due
  ON meta_webhook_failures (next_retry_at)
  WHERE resolved = false;

-- RLS: only the service role (used by the webhook + retry endpoint) touches
-- this table. Enable RLS with no permissive policies so anon/auth clients
-- cannot read or write it.
ALTER TABLE meta_webhook_failures ENABLE ROW LEVEL SECURITY;
