"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Save, Check, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getEmailSignature,
  updateEmailSignature,
  uploadSignatureImage,
} from "@/app/actions/email-signature";
import { renderSignatureHtml } from "@/lib/email/signature";
import type { EmailSignature, SignatureStyle, SignatureMode } from "@/lib/supabase/database.types";
import { DEFAULT_EMAIL_SIGNATURE } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

const MODES: { value: SignatureMode; label: string; desc: string }[] = [
  { value: "structured", label: "Form Fields", desc: "Build a signature from your details" },
  { value: "image", label: "Image Upload", desc: "Upload a pre-designed signature image" },
];

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image must be under ${MAX_IMAGE_MB}MB.`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url, error: uploadError } = await uploadSignatureImage(formData);
      if (uploadError || !url) {
        setError(uploadError ?? "Upload failed.");
      } else {
        setSig((s) => ({ ...s, imageUrl: url, mode: "image" }));
        setSaved(false);
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeImage() {
    setSig((s) => ({ ...s, imageUrl: "" }));
    setSaved(false);
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

      {/* Mode toggle */}
      <div className="space-y-2">
        <Label className="text-xs">Signature type</Label>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => update("mode", m.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                sig.mode === m.value
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-border hover:border-border/80 bg-card"
              )}
            >
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {sig.mode === "structured" ? (
        <>
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
        </>
      ) : (
        <>
          {/* Image upload */}
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {sig.imageUrl ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Signature image</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-red-400"
                      onClick={removeImage}
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-4 flex items-center justify-center">
                    <img
                      src={sig.imageUrl}
                      alt="Signature preview"
                      style={{ width: `${sig.imageWidth}px`, maxWidth: "100%", height: "auto" }}
                      className="rounded"
                    />
                  </div>
                </div>

                {/* Width slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Image width</Label>
                    <span className="text-xs text-muted-foreground font-mono">{sig.imageWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={700}
                    step={10}
                    value={sig.imageWidth}
                    onChange={(e) => update("imageWidth", Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Drag the slider to resize. The image scales proportionally.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Replace image
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-xl border border-dashed border-border py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                )}
                <span className="text-sm font-medium">
                  {uploading ? "Uploading..." : "Click to upload signature image"}
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, or GIF — max {MAX_IMAGE_MB}MB
                </span>
              </button>
            )}
          </div>
        </>
      )}

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
