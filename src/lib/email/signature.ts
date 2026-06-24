import type { EmailSignature, SignatureStyle } from "@/lib/supabase/database.types";
import { DEFAULT_EMAIL_SIGNATURE } from "@/lib/supabase/database.types";

// Merge a partial signature from the DB with defaults.
export function resolveSignature(
  raw: Record<string, any> | null | undefined
): EmailSignature {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EMAIL_SIGNATURE };
  return {
    ...DEFAULT_EMAIL_SIGNATURE,
    ...raw,
  } as EmailSignature;
}

// Check if a signature has any meaningful content.
export function hasSignature(sig: EmailSignature): boolean {
  return Boolean(
    sig.fullName ||
      sig.title ||
      sig.company ||
      sig.email ||
      sig.phone ||
      sig.website
  );
}

// Escape HTML special characters to prevent injection.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Format a website URL for display (strip protocol).
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// Render the signature as an HTML table (most email-client-compatible).
export function renderSignatureHtml(sig: EmailSignature): string {
  if (!hasSignature(sig)) return "";

  const c = esc(sig.primaryColor || "#6366f1");
  const name = esc(sig.fullName);
  const title = esc(sig.title);
  const company = esc(sig.company);
  const email = esc(sig.email);
  const phone = esc(sig.phone);
  const website = sig.website ? displayUrl(sig.website) : "";
  const websiteHref = esc(sig.website);
  const linkedin = sig.linkedinUrl ? esc(sig.linkedinUrl) : "";
  const twitter = sig.twitterUrl ? esc(sig.twitterUrl) : "";

  switch (sig.style as SignatureStyle) {
    case "minimal":
      return renderMinimal({ c, name, title, company, email, phone, website, websiteHref, linkedin, twitter });
    case "classic":
      return renderClassic({ c, name, title, company, email, phone, website, websiteHref, linkedin, twitter });
    case "modern":
    default:
      return renderModern({ c, name, title, company, email, phone, website, websiteHref, linkedin, twitter });
  }
}

type SigParts = {
  c: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  websiteHref: string;
  linkedin: string;
  twitter: string;
};

function renderModern(p: SigParts): string {
  const rows: string[] = [];

  if (p.name) rows.push(`<strong style="font-size:16px;color:#1a1a1a;">${p.name}</strong>`);
  if (p.title) rows.push(`<span style="font-size:14px;color:${p.c};font-weight:600;">${p.title}</span>`);
  if (p.company) rows.push(`<span style="font-size:14px;color:#666;">${p.company}</span>`);

  const contactLines: string[] = [];
  if (p.email) contactLines.push(`<a href="mailto:${p.email}" style="color:${p.c};text-decoration:none;font-size:13px;">${p.email}</a>`);
  if (p.phone) contactLines.push(`<span style="color:#666;font-size:13px;">${p.phone}</span>`);
  if (p.website) contactLines.push(`<a href="${p.websiteHref}" style="color:${p.c};text-decoration:none;font-size:13px;">${p.website}</a>`);

  const socials: string[] = [];
  if (p.linkedin) socials.push(`<a href="${p.linkedin}" style="color:${p.c};text-decoration:none;font-size:13px;margin-right:12px;">LinkedIn</a>`);
  if (p.twitter) socials.push(`<a href="${p.twitter}" style="color:${p.c};text-decoration:none;font-size:13px;">Twitter / X</a>`);

  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;padding-top:16px;border-top:2px solid ${p.c};">
  <tr><td style="padding-bottom:4px;">
    ${rows.map((r) => `<div style="margin-bottom:2px;">${r}</div>`).join("")}
  </td></tr>
  ${contactLines.length ? `<tr><td style="padding-top:6px;">
    ${contactLines.map((l) => `<div style="margin-bottom:2px;">${l}</div>`).join("")}
  </td></tr>` : ""}
  ${socials.length ? `<tr><td style="padding-top:6px;">${socials.join("")}</td></tr>` : ""}
</table>`;
}

function renderMinimal(p: SigParts): string {
  const lines: string[] = [];
  if (p.name) lines.push(`<strong style="font-size:15px;color:#1a1a1a;">${p.name}</strong>`);
  if (p.title || p.company) {
    const tc = [p.title, p.company].filter(Boolean).join(" · ");
    lines.push(`<span style="font-size:13px;color:#888;">${tc}</span>`);
  }
  const contact: string[] = [];
  if (p.email) contact.push(`<a href="mailto:${p.email}" style="color:#555;text-decoration:none;font-size:13px;">${p.email}</a>`);
  if (p.phone) contact.push(`<span style="color:#555;font-size:13px;">${p.phone}</span>`);
  if (p.website) contact.push(`<a href="${p.websiteHref}" style="color:#555;text-decoration:none;font-size:13px;">${p.website}</a>`);
  if (contact.length) lines.push(contact.join(`<span style="color:#ccc;margin:0 6px;">|</span>`));
  const socials: string[] = [];
  if (p.linkedin) socials.push(`<a href="${p.linkedin}" style="color:#555;text-decoration:none;font-size:13px;margin-right:10px;">LinkedIn</a>`);
  if (p.twitter) socials.push(`<a href="${p.twitter}" style="color:#555;text-decoration:none;font-size:13px;">Twitter / X</a>`);
  if (socials.length) lines.push(socials.join(""));

  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;">
  <tr><td>
    ${lines.map((l) => `<div style="margin-bottom:3px;">${l}</div>`).join("")}
  </td></tr>
</table>`;
}

function renderClassic(p: SigParts): string {
  const lines: string[] = [];
  if (p.name) lines.push(`<strong style="font-size:15px;color:#1a1a1a;">${p.name}</strong>`);
  if (p.title) lines.push(`<span style="font-size:13px;color:#444;font-style:italic;">${p.title}</span>`);
  if (p.company) lines.push(`<span style="font-size:14px;color:${p.c};font-weight:600;">${p.company}</span>`);
  if (p.email) lines.push(`<a href="mailto:${p.email}" style="color:#444;text-decoration:none;font-size:13px;">${p.email}</a>`);
  if (p.phone) lines.push(`<span style="color:#444;font-size:13px;">${p.phone}</span>`);
  if (p.website) lines.push(`<a href="${p.websiteHref}" style="color:${p.c};text-decoration:none;font-size:13px;">${p.website}</a>`);
  const socials: string[] = [];
  if (p.linkedin) socials.push(`<a href="${p.linkedin}" style="color:${p.c};text-decoration:none;font-size:13px;margin-right:12px;">LinkedIn</a>`);
  if (p.twitter) socials.push(`<a href="${p.twitter}" style="color:${p.c};text-decoration:none;font-size:13px;">Twitter / X</a>`);
  if (socials.length) lines.push(socials.join(""));

  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;padding-top:14px;border-top:1px solid #ddd;">
  <tr><td style="border-left:3px solid ${p.c};padding-left:12px;">
    ${lines.map((l) => `<div style="margin-bottom:3px;">${l}</div>`).join("")}
  </td></tr>
</table>`;
}
