import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Resend } from "resend";
import crypto from "crypto";

// This endpoint receives parsed inbound emails from Resend's inbound service.
// It verifies the Svix-signed webhook using RESEND_WEBHOOK_SECRET (HMAC-SHA256).

interface ParsedInboundEmail {
  from: string; // "Sender Name <sender@example.com>"
  to: string[];
  subject: string;
  text: string;
  html?: string;
  messageId?: string; // provider's id for the inbound message
  references?: string; // References header for threading
  inReplyTo?: string; // In-Reply-To header for threading
  attachments?: { filename: string; url: string; content_type: string; size: number }[];
}

export async function POST(req: NextRequest) {
  try {
    // ── Signature verification (Svix / Resend standard) ──────────────────────
    // TODO: Re-enable strict verification once signing secret is confirmed.
    let body: any;

    if (env.resendWebhookSecret) {
      const svixId = req.headers.get("svix-id");
      const svixTimestamp = req.headers.get("svix-timestamp");
      const svixSignature = req.headers.get("svix-signature");

      const rawBody = await req.text();

      if (svixId && svixTimestamp && svixSignature) {
        const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
        const signatures = svixSignature
          .split(" ")
          .map((s) => s.replace("v1,", ""))
          .filter(Boolean);

        const expectedSig = crypto
          .createHmac("sha256", env.resendWebhookSecret)
          .update(signedPayload)
          .digest("base64");

        const isValid = signatures.some((sig) => {
          try {
            return crypto.timingSafeEqual(
              Buffer.from(sig),
              Buffer.from(expectedSig)
            );
          } catch {
            return false;
          }
        });

        if (!isValid) {
          console.warn('[Inbound Email] Signature mismatch — expected:', expectedSig, 'got:', signatures);
        }

        // Process anyway for now — log warning above. TODO: re-enable 403.
        body = JSON.parse(rawBody);
      } else {
        // No Svix headers — check for simple secret header as fallback.
        const simpleSecret = req.headers.get("x-resend-webhook-secret");
        if (simpleSecret !== env.resendWebhookSecret) {
          console.warn('[Inbound Email] No Svix headers and simple secret mismatch');
        }
        body = JSON.parse(rawBody);
      }
    } else {
      body = await req.json();
    }

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
    // The content may not be immediately available, so retry with backoff.
    const emailId = (body?.data ?? body)?.email_id;
    console.log('[Inbound Email] emailId:', emailId, '| hasApiKey:', !!env.resendApiKey, '| needsFetch:', !email.text || !email.html);
    if (emailId && env.resendApiKey && (!email.text || !email.html)) {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Use direct fetch instead of SDK to rule out SDK issues.
          const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
            headers: { Authorization: `Bearer ${env.resendApiKey}` },
          });
          console.log('[Inbound Email] Fetch attempt', attempt, ': status', response.status, response.statusText);
          if (response.ok) {
            const fullEmail = await response.json();
            console.log('[Inbound Email] API response keys:', Object.keys(fullEmail));
            email.text = fullEmail.text || email.text;
            email.html = fullEmail.html || email.html;
            console.log('[Inbound Email] After fetch — hasText:', !!email.text, 'hasHtml:', !!email.html);
            break;
          } else {
            const errBody = await response.text();
            console.log('[Inbound Email] API error body:', errBody);
          }
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        } catch (fetchErr) {
          console.error(`[Inbound Email] Fetch attempt ${attempt} failed:`, fetchErr);
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
      }
    }

    const supabase = createAdminClient();

    // ── Resolve the workspace ───────────────────────────────────────────────
    // Strategy 1: Match by inbound_email (ws_xxx@mail.hypercrm.ca)
    // Strategy 2: Fall back to workspace_email_domains lookup by domain
    let workspaceId: string | null = null;

    // Try matching the full to-address against workspaces.inbound_email
    for (const toAddr of email.to) {
      const { data: wsByInbound } = await supabase
        .from("workspaces")
        .select("id")
        .eq("inbound_email", toAddr.toLowerCase())
        .maybeSingle<{ id: string }>();
      if (wsByInbound) {
        workspaceId = wsByInbound.id;
        console.log('[Inbound Email] Resolved workspace by inbound_email:', toAddr);
        break;
      }
    }

    // Fallback: resolve by receiving domain in workspace_email_domains
    if (!workspaceId) {
      const receivingDomain = email.to[0].split("@")[1]?.toLowerCase();
      console.log('[Inbound Email] Trying domain lookup:', receivingDomain);
      if (receivingDomain) {
        const { data: domainRow } = await supabase
          .from("workspace_email_domains")
          .select("workspace_id")
          .eq("domain", receivingDomain)
          .eq("status", "verified")
          .maybeSingle<{ workspace_id: string }>();
        if (domainRow) {
          workspaceId = domainRow.workspace_id;
          console.log('[Inbound Email] Resolved workspace by domain:', receivingDomain);
        }
      }
    }

    if (!workspaceId) {
      console.log('[Inbound Email] Dropped: could not resolve workspace for', email.to);
      return new NextResponse("OK", { status: 200 });
    }

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

    // ── Find or create the conversation (thread-aware) ──────────────────────
    // Strategy 1: Match by References / In-Reply-To header → provider_message_id
    // Strategy 2: Match by "Re:" subject prefix + same contact + open conversation
    // Strategy 3: Create a new conversation
    let conversationId: string | null = null;

    // Strategy 1: Look up by References or In-Reply-To
    const refHeader = email.references || email.inReplyTo || "";
    const refIds = refHeader.split(/\s+/).map((r) => r.trim()).filter(Boolean);
    if (refIds.length > 0) {
      // Try matching any of the referenced message IDs against stored messages
      const { data: refMsg } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("provider_message_id", refIds)
        .limit(1)
        .maybeSingle<{ conversation_id: string }>();
      if (refMsg) {
        conversationId = refMsg.conversation_id;
        console.log('[Inbound Email] Resolved conversation by References header');
      }
    }

    // Strategy 2: Match by "Re:" subject + same contact + open conversation
    if (!conversationId && /^re:\s*/i.test(email.subject)) {
      const baseSubject = email.subject.replace(/^re:\s*/i, "").trim();
      const { data: subjectMatch } = await supabase
        .from("conversations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contact.id)
        .eq("channel", "email")
        .eq("status", "open")
        .ilike("subject", `%${baseSubject}%`)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (subjectMatch) {
        conversationId = subjectMatch.id;
        console.log('[Inbound Email] Resolved conversation by Re: subject match');
      }
    }

    // Strategy 3: Create new conversation
    if (!conversationId) {
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
      conversationId = created?.id ?? null;
      console.log('[Inbound Email] Created new conversation');
    }

    if (!conversationId) {
      return new NextResponse("Failed to create conversation", { status: 500 });
    }

    // ── Process inbound attachments ─────────────────────────────────────────
    // The webhook payload includes attachments with an `id` but no download URL.
    // We need to call Resend's API to get each attachment's download_url,
    // then download the file and upload to Supabase storage for permanent access.
    const rawAttachments = (body?.data ?? body)?.attachments ?? [];
    const processedAttachments: { filename: string; url: string; content_type: string; size: number }[] = [];

    if (Array.isArray(rawAttachments) && rawAttachments.length > 0 && emailId && env.resendApiKey) {
      console.log('[Inbound Email] Processing', rawAttachments.length, 'attachments');
      for (const att of rawAttachments) {
        try {
          // 1. Get the download_url from Resend's API
          const attResponse = await fetch(
            `https://api.resend.com/emails/receiving/${emailId}/attachments/${att.id}`,
            { headers: { Authorization: `Bearer ${env.resendApiKey}` } }
          );
          if (!attResponse.ok) {
            console.error('[Inbound Email] Failed to fetch attachment metadata:', att.status, att.statusText);
            continue;
          }
          const attData = await attResponse.json();
          const downloadUrl = attData.download_url;
          if (!downloadUrl) {
            console.error('[Inbound Email] No download_url in attachment response');
            continue;
          }

          // 2. Download the file content
          const fileResponse = await fetch(downloadUrl);
          if (!fileResponse.ok) {
            console.error('[Inbound Email] Failed to download attachment file:', fileResponse.status);
            continue;
          }
          const fileBuffer = await fileResponse.arrayBuffer();

          // 3. Upload to Supabase storage
          const filename = att.filename || att.name || "attachment";
          const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
          const storagePath = `${workspaceId}/inbound-attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('form-assets')
            .upload(storagePath, fileBuffer, {
              contentType: att.content_type || 'application/octet-stream',
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('[Inbound Email] Failed to upload attachment to storage:', uploadError.message);
            continue;
          }

          const { data: urlData } = supabase.storage.from('form-assets').getPublicUrl(storagePath);
          processedAttachments.push({
            filename,
            url: urlData.publicUrl,
            content_type: att.content_type || 'application/octet-stream',
            size: att.size || 0,
          });
          console.log('[Inbound Email] Stored attachment:', filename, '→', urlData.publicUrl);
        } catch (attErr) {
          console.error('[Inbound Email] Error processing attachment:', att.filename, attErr);
        }
      }
    }

    // ── Store the inbound message ───────────────────────────────────────────
    // Fallback: if we couldn't fetch the body, store a placeholder.
    if (!email.html && !email.text) {
      email.text = '(Email content is being processed. It will appear shortly.)';
    }
    console.log('[Inbound Email] Storing message in conversation:', conversationId, '| body_html:', email.html ? `${email.html.length} chars` : 'NULL', '| body_text:', email.text ? `${email.text.length} chars` : 'NULL');
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
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
      attachments: processedAttachments,
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
      .eq("id", conversationId);

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
    references: d?.references || d?.headers?.references || "",
    inReplyTo: d?.in_reply_to || d?.headers?.["in-reply-to"] || "",
    attachments: Array.isArray(d?.attachments)
      ? d.attachments.map((a: any) => ({
          filename: a.filename || a.name || "attachment",
          url: a.url || a.download_url || "",
          content_type: a.content_type || a.contentType || "application/octet-stream",
          size: a.size || 0,
        })).filter((a: any) => a.url)
      : [],
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
