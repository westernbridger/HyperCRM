import { NextRequest, NextResponse } from "next/server";

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? "";

// ── Webhook Verification (GET) ────────────────────────────
// Meta calls this once when you register the webhook URL in the Developer Portal.
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

// ── Lead Processing Placeholder ───────────────────────────
// TODO: Replace with real Graph API call once page_access_token is stored.
// GET https://graph.facebook.com/v19.0/{leadgen_id}?access_token={PAGE_ACCESS_TOKEN}
async function processMetaLead(leadgenId: string, pageId?: string): Promise<void> {
  console.log(`[Meta Webhook] Processing leadgen_id=${leadgenId} page_id=${pageId ?? "unknown"}`);
  // 1. Look up the workspace's page_access_token from meta_integrations table
  // 2. Fetch lead data from Graph API
  // 3. Create/update a Contact in Supabase with status='Lead',
  //    custom_fields.meta_form_id, custom_fields.campaign_name, etc.
}

// ── Webhook Event Handler (POST) ─────────────────────────
// Meta sends real-time lead events here after a form submission.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Meta Webhook] Incoming payload:", JSON.stringify(body, null, 2));

    const entries: any[] = body?.entry ?? [];

    for (const entry of entries) {
      const pageId: string | undefined = entry?.id;
      const changes: any[] = entry?.changes ?? [];

      for (const change of changes) {
        if (change?.field === "leadgen") {
          const leadgenId: string | undefined = change?.value?.leadgen_id;
          if (leadgenId) {
            await processMetaLead(leadgenId, pageId);
          }
        }
      }
    }

    // Meta requires a 200 response to acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[Meta Webhook] Error processing payload:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
