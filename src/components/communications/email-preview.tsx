"use client";

import { useState, useMemo } from "react";
import { Monitor, Smartphone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveTemplate, type TemplateContext } from "@/lib/email/liquid";

interface EmailPreviewProps {
  subject: string;
  bodyHtml: string;
  fromName?: string;
  fromEmail?: string;
  signatureHtml?: string;
  sampleContacts: { id: string; name: string; email: string; ctx: TemplateContext }[];
}

export function EmailPreview({
  subject,
  bodyHtml,
  fromName = "Your Workspace",
  fromEmail = "noreply@hypercrm.ca",
  signatureHtml = "",
  sampleContacts,
}: EmailPreviewProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(
    sampleContacts[0]?.id ?? ""
  );

  const selectedContact = useMemo(
    () => sampleContacts.find((c) => c.id === selectedContactId) ?? sampleContacts[0],
    [sampleContacts, selectedContactId]
  );

  const resolvedSubject = useMemo(() => {
    if (!selectedContact) return subject;
    return resolveTemplate(subject, selectedContact.ctx);
  }, [subject, selectedContact]);

  const resolvedBody = useMemo(() => {
    if (!selectedContact) return bodyHtml;
    const resolved = resolveTemplate(bodyHtml, selectedContact.ctx);
    return signatureHtml ? `${resolved}${signatureHtml}` : resolved;
  }, [bodyHtml, selectedContact, signatureHtml]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Preview as selector */}
        {sampleContacts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preview as:</span>
            <div className="relative">
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-card pl-3 pr-8 py-1.5 text-xs text-foreground focus:outline-none"
              >
                {sampleContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* Desktop / Mobile toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => setIsMobile(false)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors",
              !isMobile ? "bg-secondary text-foreground" : "text-muted-foreground"
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            onClick={() => setIsMobile(true)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors",
              isMobile ? "bg-secondary text-foreground" : "text-muted-foreground"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>
      </div>

      {/* Email client mockup */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div
          className="mx-auto transition-all duration-300"
          style={{ maxWidth: isMobile ? "375px" : "600px" }}
        >
          {/* Email header (Gmail-like) */}
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2 break-words">
              {resolvedSubject || "(no subject)"}
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
                {fromName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{fromName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {fromEmail} → {selectedContact?.email ?? "recipient@email.com"}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          </div>

          {/* Email body */}
          <div
            className="px-5 py-4 text-gray-800"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "14px", lineHeight: "1.6" }}
          >
            {resolvedBody ? (
              <div dangerouslySetInnerHTML={{ __html: resolvedBody }} />
            ) : (
              <p className="text-gray-400 text-sm italic">Email body will appear here…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
