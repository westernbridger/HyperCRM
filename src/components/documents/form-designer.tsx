"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Monitor, Smartphone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormRenderer } from "@/components/forms/form-renderer";
import { FontLoader } from "@/components/forms/font-loader";
import { uploadFormAsset, type HyperForm } from "@/app/actions/forms";
import type {
  HyperFormTheme,
  HyperFormBranding,
  HyperFormLayout,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const FONTS = [
  "Inter",
  "Open Sans",
  "Roboto",
  "Poppins",
  "Lora",
  "Playfair Display",
  "Space Grotesk",
  "system",
];

const RADII = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra" },
  { value: "full", label: "Pill" },
];

const BUTTON_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "outline", label: "Outline" },
  { value: "soft", label: "Soft" },
];

const LAYOUTS: { value: HyperFormLayout; label: string; desc: string }[] = [
  { value: "card", label: "Card", desc: "Centered card" },
  { value: "single-page", label: "Single Page", desc: "Full-width, no card" },
  { value: "multi-step", label: "Multi-step", desc: "One question at a time" },
];

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#06b6d4", "#3b82f6", "#0ea5e9", "#14b8a6",
];

// Keep in sync with the server-side limit in uploadFormAsset()
const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

interface FormDesignerProps {
  form: HyperForm;
  theme: HyperFormTheme;
  branding: HyperFormBranding;
  layout: HyperFormLayout;
  onThemeChange: (t: HyperFormTheme) => void;
  onBrandingChange: (b: HyperFormBranding) => void;
  onLayoutChange: (l: HyperFormLayout) => void;
}

export function FormDesigner({
  form,
  theme,
  branding,
  layout,
  onThemeChange,
  onBrandingChange,
  onLayoutChange,
}: FormDesignerProps) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  function setTheme<K extends keyof HyperFormTheme>(key: K, value: HyperFormTheme[K]) {
    onThemeChange({ ...theme, [key]: value });
  }
  function setBranding<K extends keyof HyperFormBranding>(key: K, value: HyperFormBranding[K]) {
    onBrandingChange({ ...branding, [key]: value });
  }

  // Preview uses the in-progress theme/branding/layout
  const previewForm: HyperForm = { ...form, theme, branding, layout };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      {/* ── Controls ── */}
      <div className="space-y-6 overflow-y-auto lg:max-h-[calc(100vh-16rem)] pr-1">
        {/* Layout */}
        <Section title="Layout">
          <div className="grid grid-cols-3 gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.value}
                onClick={() => onLayoutChange(l.value)}
                className={cn(
                  "rounded-lg border p-2.5 text-left transition-colors",
                  layout === l.value
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-border hover:bg-secondary/50"
                )}
              >
                <p className="text-xs font-semibold">{l.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{l.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Colors */}
        <Section title="Colors">
          <ColorField
            label="Primary / accent"
            value={theme.primaryColor}
            onChange={(v) => setTheme("primaryColor", v)}
            presets
          />
          <ColorField
            label="Background"
            value={theme.backgroundColor}
            onChange={(v) => setTheme("backgroundColor", v)}
          />
          <ColorField
            label="Text"
            value={theme.textColor}
            onChange={(v) => setTheme("textColor", v)}
          />
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-1.5">
            <Label className="text-xs">Font</Label>
            <Select value={theme.fontFamily} onValueChange={(v) => setTheme("fontFamily", v as HyperFormTheme["fontFamily"])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f} value={f}>{f === "system" ? "System default" : f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Shape & buttons */}
        <Section title="Shape & Buttons">
          <div className="space-y-1.5">
            <Label className="text-xs">Corner radius</Label>
            <Select value={theme.borderRadius} onValueChange={(v) => setTheme("borderRadius", v as HyperFormTheme["borderRadius"])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RADII.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Button style</Label>
            <Select value={theme.buttonStyle} onValueChange={(v) => setTheme("buttonStyle", v as HyperFormTheme["buttonStyle"])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUTTON_STYLES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Images */}
        <Section title="Images">
          <ImageUpload label="Logo" kind="logo" url={branding.logoUrl} onChange={(u) => setBranding("logoUrl", u)} />
          <ImageUpload label="Cover image" kind="cover" url={branding.coverUrl} onChange={(u) => setBranding("coverUrl", u)} />
          <ImageUpload label="Background image" kind="background" url={branding.backgroundUrl} onChange={(u) => setBranding("backgroundUrl", u)} />
        </Section>

        {/* Content */}
        <Section title="Content">
          <div className="space-y-1.5">
            <Label className="text-xs">Submit button text</Label>
            <Input value={branding.submitText} onChange={(e) => setBranding("submitText", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Success title</Label>
            <Input value={branding.successTitle} onChange={(e) => setBranding("successTitle", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Success message</Label>
            <Input value={branding.successMessage} onChange={(e) => setBranding("successMessage", e.target.value)} className="h-9" />
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <Switch id="badge" checked={branding.showBadge} onCheckedChange={(v) => setBranding("showBadge", v)} />
            <Label htmlFor="badge" className="text-xs cursor-pointer">Show &quot;Powered by HyperCRM&quot; badge</Label>
          </div>
        </Section>
      </div>

      {/* ── Live preview ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Live preview</Label>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setPreviewDevice("desktop")}
              className={cn("rounded p-1.5", previewDevice === "desktop" ? "bg-secondary" : "text-muted-foreground")}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPreviewDevice("mobile")}
              className={cn("rounded p-1.5", previewDevice === "mobile" ? "bg-secondary" : "text-muted-foreground")}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <FontLoader family={theme.fontFamily} />
        <div className="rounded-xl border border-border overflow-hidden bg-secondary/20">
          <div
            className={cn(
              "mx-auto transition-all duration-300 overflow-hidden",
              previewDevice === "mobile" ? "max-w-[380px]" : "w-full"
            )}
          >
            <div className="h-[calc(100vh-18rem)] overflow-y-auto">
              <FormRenderer key={`${layout}-${previewDevice}`} form={previewForm} mode="preview" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 p-0"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-xs"
        />
      </div>
      {presets && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={cn(
                "h-5 w-5 rounded-full border transition-transform hover:scale-110",
                value.toLowerCase() === c.toLowerCase() ? "border-foreground ring-1 ring-foreground" : "border-border"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImageUpload({
  label,
  kind,
  url,
  onChange,
}: {
  label: string;
  kind: string;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always clear the input so the same file can be re-selected after an error.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setError(null);

    // Client-side validation — fail fast before hitting the server action.
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`Image is ${mb}MB — please use one under ${MAX_IMAGE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const { url: uploadedUrl, error: uploadError } = await uploadFormAsset(fd);
      if (uploadError) setError(uploadError);
      else onChange(uploadedUrl);
    } catch {
      setError("Upload failed. Please try a smaller image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="relative group rounded-lg border border-border overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-20 w-full object-cover" />
          <button
            onClick={() => onChange(null)}
            className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary/40 transition-colors"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      )}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
