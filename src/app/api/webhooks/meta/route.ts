import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const META_VERIFY_TOKEN  = process.env.META_VERIFY_TOKEN ?? "";
const GRAPH_API_VERSION  = "v19.0";

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

// ── Helpers ───────────────────────────────────────────────

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

async function processMetaLead(leadgenId: string, pageId?: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 1. Look up page access token + workspace from meta_integrations
  const { data: integration, error: intErr } = await supabase
    .from("meta_integrations")
    .select("page_access_token, workspace_id")
    .eq("page_id", pageId ?? "")
    .maybeSingle();

  if (intErr || !integration) {
    console.error(`[Meta Webhook] No integration for page_id=${pageId}:`, intErr?.message);
    return;
  }

  // 2. Fetch lead data from Meta Graph API
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}`);
  url.searchParams.set(
    "fields",
    "field_data,created_time,ad_id,form_id,ad_name,adset_name,campaign_name"
  );
  url.searchParams.set("access_token", integration.page_access_token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(`[Meta Webhook] Graph API error (${res.status}):`, await res.text());
    return;
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
    return;
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
    console.error(`[Meta Webhook] Failed to create contact:`, createErr?.message);
    return;
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
}

// ── Webhook Verification (GET) ────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === META_VERIFY_TOKEN && challenge) {
    console.log("[Meta Webhook] ✓ Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Meta Webhook] ✗ Verification failed", { mode, receivedToken: token });
  return new NextResponse("Forbidden", { status: 403 });
}

// ── Webhook Event Handler (POST) ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[Meta Webhook Inbound Payload]", JSON.stringify(body, null, 2));

    const entries: any[] = body?.entry ?? [];
    for (const entry of entries) {
      const entryPageId = entry?.id?.toString();
      for (const change of (entry?.changes ?? []) as any[]) {
        if (change?.field === "leadgen" && change?.value?.leadgen_id) {
          const fallbackPageId = change?.value?.page_id?.toString();
          const pageId: string | undefined = entryPageId ?? fallbackPageId;
          console.log(`[Meta Webhook] Resolved pageId="${pageId}" (entry.id="${entryPageId}", changes.value.page_id="${fallbackPageId}")`);
          await processMetaLead(change.value.leadgen_id, pageId);
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[Meta Webhook] Error processing payload:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
