// Meta Lead Ads processing core.
// Shared by the webhook route (src/app/api/webhooks/meta/route.ts) and the
// retry endpoint (src/app/api/webhooks/meta/retry/route.ts). Keeping this out
// of the route file lets both import it (route files should only export HTTP
// handlers) and keeps the logic unit-testable.

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureFieldDefinitions } from "@/lib/data/field-definitions";

const GRAPH_API_VERSION = "v19.0";
const MAX_RETRY_ATTEMPTS = 6;

// ── Types ─────────────────────────────────────────────────

type FieldData = { name: string; values: string[] };

type LeadgenData = {
  id: string;
  created_time: number;
  ad_id?: string;
  form_id?: string;
  field_data: FieldData[];
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
};

export type ProcessResult =
  | { ok: true }
  | { ok: false; retryable: boolean; error: string };

// ── Field helpers ─────────────────────────────────────────

function getField(fields: FieldData[], name: string): string | null {
  return fields.find((f) => f.name === name)?.values?.[0] ?? null;
}

function parseName(fields: FieldData[]): { first: string; last: string } {
  const full = getField(fields, "full_name");
  if (full) {
    const parts = full.trim().split(/\s+/);
    return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
  }
  return {
    first: getField(fields, "first_name") ?? "",
    last:  getField(fields, "last_name")  ?? "",
  };
}

// ── Core: fetch lead from Graph API and upsert Contact ────

export async function processMetaLead(leadgenId: string, pageId?: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  // 1. Look up page access token + workspace from meta_integrations
  const { data: integration, error: intErr } = await supabase
    .from("meta_integrations")
    .select("page_access_token, workspace_id")
    .eq("page_id", pageId ?? "")
    .maybeSingle();

  if (intErr || !integration) {
    const msg = `No integration for page_id=${pageId}: ${intErr?.message ?? "not found"}`;
    console.error(`[Meta Webhook] ${msg}`);
    // Config issue — retrying won't help until the integration is set up.
    return { ok: false, retryable: false, error: msg };
  }

  // 2. Fetch lead data from Meta Graph API
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}`);
  url.searchParams.set(
    "fields",
    "field_data,created_time,ad_id,form_id,ad_name,adset_name,campaign_name"
  );
  url.searchParams.set("access_token", integration.page_access_token);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    // Network error reaching Graph API — transient, retry later.
    const msg = `Graph API fetch failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[Meta Webhook] ${msg}`);
    return { ok: false, retryable: true, error: msg };
  }

  if (!res.ok) {
    const body = await res.text();
    const msg = `Graph API error (${res.status}): ${body}`;
    console.error(`[Meta Webhook] ${msg}`);
    // 5xx + 429 are transient; an expired token (190) becomes processable once
    // refreshed, so treat it as retryable too. Other 4xx are not.
    const retryable = res.status >= 500 || res.status === 429 || body.includes('"code":190');
    return { ok: false, retryable, error: msg };
  }
  const lead: LeadgenData = await res.json();

  // 3. Parse standard fields
  const { first, last } = parseName(lead.field_data);
  const email   = getField(lead.field_data, "email") ?? `meta_${leadgenId}@noreply.local`;
  const phone   = getField(lead.field_data, "phone_number");
  const company = getField(lead.field_data, "company_name");

  // Collect non-standard fields into custom_fields
  const knownFields = new Set(["full_name","first_name","last_name","email","phone_number","company_name"]);
  const extraFields: Record<string, string> = {};
  for (const f of lead.field_data) {
    if (!knownFields.has(f.name)) extraFields[f.name] = f.values?.[0] ?? "";
  }

  const custom_fields: Record<string, any> = {
    source:        "Meta Lead Ad",
    meta_lead_id:  leadgenId,
    meta_form_id:  lead.form_id,
    meta_ad_id:    lead.ad_id,
    campaign_name: lead.campaign_name,
    ad_name:       lead.ad_name,
    adset_name:    lead.adset_name,
    ...extraFields,
  };

  // 4. Deduplicate — update custom_fields if email already exists in workspace
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", integration.workspace_id)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("contacts")
      .update({ custom_fields, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    console.log(`[Meta Webhook] Updated existing contact id=${existing.id}`);
    return { ok: true };
  }

  // 5. Create new Contact with status Lead
  const { data: contact, error: createErr } = await supabase
    .from("contacts")
    .insert({
      workspace_id: integration.workspace_id,
      first_name:   first || "Unknown",
      last_name:    last,
      email,
      phone,
      company,
      status:        "Lead",
      custom_fields,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createErr || !contact) {
    const msg = `Failed to create contact: ${createErr?.message ?? "unknown error"}`;
    console.error(`[Meta Webhook] ${msg}`);
    // Likely a transient DB issue — allow retry.
    return { ok: false, retryable: true, error: msg };
  }

  // 6. Log activity
  await supabase.from("activities").insert({
    contact_id:   contact.id,
    workspace_id: integration.workspace_id,
    type:         "creation",
    title:        "Lead captured via Meta Lead Ad",
    content:      `New lead from campaign "${lead.campaign_name ?? "Unknown"}" via Meta Lead Form.`,
    metadata:     { source: "meta_lead_ad", form_id: lead.form_id, ad_name: lead.ad_name },
  });

  console.log(`[Meta Webhook] ✓ Contact created id=${contact.id} leadgen_id=${leadgenId}`);

  // Auto-create custom field definitions for any new attributes
  await ensureFieldDefinitions(integration.workspace_id, custom_fields).catch((e) =>
    console.error('[Meta Webhook] Field definition error (non-fatal):', e)
  );

  return { ok: true };
}

// ── Failure queue ─────────────────────────────────────────

// Exponential backoff: 1m, 2m, 4m, 8m, 16m, 32m (capped).
function backoffMs(attempts: number): number {
  return Math.min(2 ** (attempts - 1), 32) * 60_000;
}

// Record (or update) a failed lead so a later retry can re-process it.
async function recordFailure(leadgenId: string, pageId: string | undefined, error: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("meta_webhook_failures")
    .select("attempts")
    .eq("leadgen_id", leadgenId)
    .maybeSingle();

  const attempts = (existing?.attempts ?? 0) + 1;
  const nextRetry = new Date(Date.now() + backoffMs(attempts)).toISOString();
  // Stop retrying after the cap — leave the row unresolved for manual inspection.
  const resolved = attempts > MAX_RETRY_ATTEMPTS;

  await supabase
    .from("meta_webhook_failures")
    .upsert(
      {
        leadgen_id:    leadgenId,
        page_id:       pageId ?? null,
        attempts,
        last_error:    error,
        next_retry_at: nextRetry,
        resolved,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "leadgen_id" }
    );
}

// Mark a previously-failed lead as resolved after a successful retry.
async function resolveFailure(leadgenId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("meta_webhook_failures")
    .update({ resolved: true, updated_at: new Date().toISOString() })
    .eq("leadgen_id", leadgenId);
}

// Process a single lead and route the outcome to the failure queue.
export async function handleLead(leadgenId: string, pageId?: string): Promise<void> {
  const result = await processMetaLead(leadgenId, pageId);
  if (result.ok) {
    await resolveFailure(leadgenId);
  } else if (result.retryable) {
    await recordFailure(leadgenId, pageId, result.error);
  }
}

// Re-process all queued failures whose backoff window has elapsed.
// Returns counts for observability. Called by the retry endpoint / cron.
export async function retryDueFailures(limit = 25): Promise<{ processed: number; succeeded: number }> {
  const supabase = createAdminClient();
  const { data: due } = await supabase
    .from("meta_webhook_failures")
    .select("leadgen_id, page_id")
    .eq("resolved", false)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (!due || due.length === 0) return { processed: 0, succeeded: 0 };

  let succeeded = 0;
  for (const row of due) {
    const result = await processMetaLead(row.leadgen_id, row.page_id ?? undefined);
    if (result.ok) {
      await resolveFailure(row.leadgen_id);
      succeeded++;
    } else if (result.retryable) {
      await recordFailure(row.leadgen_id, row.page_id ?? undefined, result.error);
    } else {
      // Permanent failure — mark resolved so it stops cycling.
      await resolveFailure(row.leadgen_id);
    }
  }

  return { processed: due.length, succeeded };
}
