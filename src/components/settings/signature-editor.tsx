"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getEmailSignature,
  updateEmailSignature,
} from "@/app/actions/email-signature";
import { renderSignatureHtml } from "@/lib/email/signature";
import type { EmailSignature, SignatureStyle } from "@/lib/supabase/database.types";
import { DEFAULT_EMAIL_SIGNATURE } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const STYLES: { value: SignatureStyle; label: string; desc: string }[] = [
  { value: "modern", label: "Modern", desc: "Bold accent bar, clean layout" },
  { value: "minimal", label: "Minimal", desc: "Subtle, pipe-separated contact line" },
  { value: "classic", label: "Classic", desc: "Left accent border, italic title" },
];

export function SignatureEditor() {
  const [sig, setSig] = useState<EmailSignature>({ ...DEFAULT_EMAIL_SIGNATURE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getEmailSignature();
    if (data) setSig(data);
    if (error) setError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof EmailSignature>(key: K, value: EmailSignature[K]) {
    setSig((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error } = await updateEmailSignature(sig);
    setSaving(false);
    if (error) {
      setError(error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const previewHtml = renderSignatureHtml(sig);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Email Signature</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically appended to every email sent from your workspace.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Style picker */}
      <div className="space-y-2">
        <Label className="text-xs">Style</Label>
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => update("style", s.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                sig.style === s.value
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-border hover:border-border/80 bg-card"
              )}
            >
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Full name" value={sig.fullName} onChange={(v) => update("fullName", v)} placeholder="Jane Doe" />
        <FieldGroup label="Job title" value={sig.title} onChange={(v) => update("title", v)} placeholder="Sales Manager" />
        <FieldGroup label="Company" value={sig.company} onChange={(v) => update("company", v)} placeholder="Acme Inc." />
        <FieldGroup label="Email" value={sig.email} onChange={(v) => update("email", v)} placeholder="jane@acme.com" />
        <FieldGroup label="Phone" value={sig.phone} onChange={(v) => update("phone", v)} placeholder="+1 (555) 123-4567" />
        <FieldGroup label="Website" value={sig.website} onChange={(v) => update("website", v)} placeholder="https://acme.com" />
        <FieldGroup label="LinkedIn URL" value={sig.linkedinUrl} onChange={(v) => update("linkedinUrl", v)} placeholder="https://linkedin.com/in/janedoe" />
        <FieldGroup label="Twitter / X URL" value={sig.twitterUrl} onChange={(v) => update("twitterUrl", v)} placeholder="https://x.com/janedoe" />
        <div className="space-y-1.5">
          <Label className="text-xs">Accent color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={sig.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
            />
            <Input
              value={sig.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="w-28 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <Label className="text-xs">Preview</Label>
        <div className="rounded-xl border border-border bg-white p-6 overflow-x-auto">
          <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "15px", lineHeight: "1.6", color: "#1a1a1a" }}>
            <p style={{ margin: "0 0 12px", color: "#666" }}>Hi there,</p>
            <p style={{ margin: "0 0 12px", color: "#1a1a1a" }}>
              Thanks for reaching out! I&apos;ve attached the proposal we discussed.
              Let me know if you have any questions.
            </p>
            <p style={{ margin: "0 0 4px", color: "#1a1a1a" }}>Best,</p>
            <div dangerouslySetInnerHTML={{ __html: previewHtml || '<span style="color:#999;font-size:13px;">Fill in the fields above to see your signature.</span>' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
