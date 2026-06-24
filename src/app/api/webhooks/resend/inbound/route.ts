import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Resend } from "resend";

// This endpoint receives parsed inbound emails from Resend's inbound service.
// It is a SKELETON / reference implementation for the receiving architecture
// described in the project docs. Before it is live, you must:
//   1. Enable Resend inbound on your account/domain and point the inbound route
//      to your domain's MX records (e.g. mx.resend.com).
//   2. Configure the webhook URL in Resend: https://yourapp.com/api/webhooks/resend/inbound
//   3. Add RESEND_WEBHOOK_SECRET to your environment and validate the signature.
//
// If you use a different inbound provider (Cloudflare Email Routing, Postmark,
// Mailgun, etc.), the route path and signature verification change, but the
// database logic below is the same.

interface ParsedInboundEmail {
  from: string; // "Sender Name <sender@example.com>"
  to: string[];
  subject: string;
  text: string;
  html?: string;
  messageId?: string; // provider's id for the inbound message
}

export async function POST(req: NextRequest) {
  try {
    // ── Signature verification (recommended) ─────────────────────────────────
    // Resend signs inbound webhooks with RESEND_WEBHOOK_SECRET. Replace the
    // naive check below with HMAC-SHA256 verification once you have the secret.
    const providedSecret = req.headers.get("x-resend-webhook-secret");
    if (env.resendWebhookSecret && providedSecret !== env.resendWebhookSecret) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();

    // Only process email.received events.
    if (body?.type && body.type !== "email.received") {
      return new NextResponse("OK", { status: 200 });
    }

    const email = normalizeEmail(body) as ParsedInboundEmail;
    console.log('[Inbound Email] Parsed:', { from: email.from, to: email.to, subject: email.subject, hasText: !!email.text, hasHtml: !!email.html });
    if (!email.from || !email.to.length) {
      console.log('[Inbound Email] Rejected: missing from or to');
      return new NextResponse("Bad Request", { status: 400 });
    }

    // Resend's webhook only includes metadata — fetch the full body via API.
    const emailId = (body?.data ?? body)?.email_id;
    if (emailId && env.resendApiKey && (!email.text || !email.html)) {
      try {
        const resend = new Resend(env.resendApiKey);
        const { data: fullEmail } = await resend.emails.receiving.get(emailId);
        if (fullEmail) {
          email.text = fullEmail.text || email.text;
          email.html = fullEmail.html || email.html;
        }
      } catch (fetchErr) {
        console.error("[Inbound Email] Failed to fetch email content:", fetchErr);
      }
    }

    const supabase = createAdminClient();

    // ── Resolve the workspace by the receiving domain ───────────────────────
    const receivingDomain = email.to[0].split("@")[1]?.toLowerCase();
    console.log('[Inbound Email] Receiving domain:', receivingDomain);
    if (!receivingDomain) {
      return new NextResponse("No receiving domain", { status: 400 });
    }

    const { data: domainRow, error: domainErr } = await supabase
      .from("workspace_email_domains")
      .select("workspace_id, domain, status")
      .eq("domain", receivingDomain)
      .eq("status", "verified")
      .single<{ workspace_id: string; domain: string; status: string }>();

    console.log('[Inbound Email] Domain lookup:', domainRow ? { workspace_id: domainRow.workspace_id, domain: domainRow.domain } : 'NOT FOUND', domainErr ? `error: ${domainErr.message}` : '');

    if (!domainRow) {
      // No workspace owns this receiving domain — drop the email silently.
      console.log('[Inbound Email] Dropped: no workspace owns domain', receivingDomain);
      return new NextResponse("OK", { status: 200 });
    }
    const workspaceId = domainRow.workspace_id;

    // ── Resolve the contact by sender email ─────────────────────────────────
    const senderEmail = extractEmail(email.from);
    const senderName = extractName(email.from) || senderEmail;
    console.log('[Inbound Email] Sender:', senderEmail, '| Name:', senderName);

    let { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", senderEmail)
      .maybeSingle<{ id: string }>();

    // Optionally auto-create unknown senders as contacts so inbound replies
    // from new leads still show up in the inbox.
    if (!contact) {
      const { data: created } = await supabase
        .from("contacts")
        .insert({
          workspace_id: workspaceId,
          email: senderEmail,
          first_name: senderName,
          last_name: "",
          status: "Lead",
          custom_fields: { source: "email-inbound" },
        })
        .select("id")
        .single<{ id: string }>();
      contact = created ?? null;
    }

    if (!contact) {
      return new NextResponse("Failed to resolve contact", { status: 500 });
    }

    // ── Find or create the conversation ──────────────────────────────────────
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contact.id)
      .eq("channel", "email")
      .eq("status", "open")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (!conversation) {
      const { data: created } = await supabase
        .from("conversations")
        .insert({
          workspace_id: workspaceId,
          contact_id: contact.id,
          channel: "email",
          subject: email.subject,
        })
        .select("id")
        .single<{ id: string }>();
      conversation = created ?? null;
    }

    if (!conversation) {
      return new NextResponse("Failed to create conversation", { status: 500 });
    }

    // ── Store the inbound message ───────────────────────────────────────────
    console.log('[Inbound Email] Storing message in conversation:', conversation.id);
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      workspace_id: workspaceId,
      contact_id: contact.id,
      channel: "email",
      direction: "inbound",
      from_addr: email.from,
      to_addr: email.to.join(", "),
      subject: email.subject,
      body_html: email.html ?? null,
      body_text: email.text,
      provider: "resend",
      provider_message_id: email.messageId ?? null,
      status: "received",
      metadata: { source: "inbound-webhook" },
    });

    if (msgErr) {
      console.error("[Inbound Email] Failed to save message:", msgErr);
      return new NextResponse("Failed to save message", { status: 500 });
    }

    console.log('[Inbound Email] Success: message stored');

    // Update the conversation's last message timestamp.
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[Inbound Email] Error processing inbound email:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

function normalizeEmail(body: any): Partial<ParsedInboundEmail> {
  // Resend "email.received" webhook payload:
  // { type: "email.received", data: { from, to, subject, text, html, ... } }
  const d = body?.data ?? body
  return {
    from: d?.from || "",
    to: Array.isArray(d?.to) ? d.to : [d?.to].filter(Boolean),
    subject: d?.subject || "",
    text: d?.text || "",
    html: d?.html || "",
    messageId: d?.message_id || d?.email_id || d?.id,
  };
}

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).toLowerCase().trim();
}

function extractName(raw: string): string | null {
  const match = raw.match(/^([^<]+)</);
  return match ? match[1].trim() : null;
}
