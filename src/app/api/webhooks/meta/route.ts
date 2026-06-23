import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { handleLead } from "@/lib/meta/process-lead";

// Verify the X-Hub-Signature-256 header Meta sends with every webhook POST.
// The signature is an HMAC-SHA256 of the raw request body keyed with the app
// secret. Reject any payload that doesn't match — this prevents spoofed leads.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!env.metaAppSecret) {
    // Misconfiguration: fail closed rather than accept unverified payloads.
    console.error("[Meta Webhook] META_APP_SECRET not set — rejecting payload.");
    return false;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", env.metaAppSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

// ── Webhook Verification (GET) ────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && env.metaVerifyToken && token === env.metaVerifyToken && challenge) {
    console.log("[Meta Webhook] ✓ Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Meta Webhook] ✗ Verification failed", { mode, receivedToken: token });
  return new NextResponse("Forbidden", { status: 403 });
}

// ── Webhook Event Handler (POST) ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Read the RAW body first — signature verification must run against the
    // exact bytes Meta signed, before any JSON parsing/normalisation.
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!verifySignature(rawBody, signature)) {
      console.warn("[Meta Webhook] ✗ Invalid or missing signature — rejecting.");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBody);

    console.log("[Meta Webhook Inbound Payload]", JSON.stringify(body, null, 2));

    const entries: any[] = body?.entry ?? [];
    for (const entry of entries) {
      const entryPageId = entry?.id?.toString();
      for (const change of (entry?.changes ?? []) as any[]) {
        if (change?.field === "leadgen" && change?.value?.leadgen_id) {
          const nestedPageId = change?.value?.page_id?.toString();
          const pageId: string | undefined = nestedPageId || entryPageId;
          console.log(`[Meta Webhook] Resolved pageId="${pageId}" (changes.value.page_id="${nestedPageId}", entry.id="${entryPageId}")`);

          if (pageId === "0" || pageId === "444444444444") {
            console.log("[Meta Webhook] Sandbox Test Detected. Simulating success.");
            return new Response("OK", { status: 200 });
          }

          await handleLead(change.value.leadgen_id, pageId);
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[Meta Webhook] Error processing payload:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
