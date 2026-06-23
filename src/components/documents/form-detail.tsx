"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Edit3,
  Save,
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  FileText,
  LayoutGrid,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Palette,
  Code2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormBuilder } from "./form-builder";
import { SubmissionsBoard } from "./submissions-board";
import { FormDesigner } from "./form-designer";
import { EmbedPanel } from "./embed-panel";
import {
  updateForm,
  deleteForm,
  getFormSubmissions,
  type HyperForm,
  type HyperFormSubmission,
} from "@/app/actions/forms";
import type {
  HyperFormField,
  HyperFormTheme,
  HyperFormBranding,
  HyperFormLayout,
} from "@/lib/supabase/database.types";
import { resolveTheme, resolveBranding } from "@/lib/forms/theme";
import { cn } from "@/lib/utils";

interface FormDetailProps {
  form: HyperForm;
  onUpdated: (form: HyperForm) => void;
  onDeleted: (id: string) => void;
}

export function FormDetail({ form, onUpdated, onDeleted }: FormDetailProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? "");
  const [fields, setFields] = useState<HyperFormField[]>(form.fields);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submissions, setSubmissions] = useState<HyperFormSubmission[] | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Design state
  const [theme, setThemeState] = useState<HyperFormTheme>(resolveTheme(form.theme));
  const [branding, setBrandingState] = useState<HyperFormBranding>(resolveBranding(form.branding));
  const [layout, setLayoutState] = useState<HyperFormLayout>(form.layout ?? "card");
  const [designDirty, setDesignDirty] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  const formUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/forms/${form.id}`
      : `/forms/${form.id}`;

  // Reset local state when form changes
  useEffect(() => {
    setName(form.name);
    setDescription(form.description ?? "");
    setFields(form.fields);
    setEditing(false);
    setSubmissions(null);
    setThemeState(resolveTheme(form.theme));
    setBrandingState(resolveBranding(form.branding));
    setLayoutState(form.layout ?? "card");
    setDesignDirty(false);
  }, [form.id]);

  async function handleSaveDesign() {
    setSavingDesign(true);
    const { data } = await updateForm(form.id, { theme, layout, branding });
    setSavingDesign(false);
    if (data) {
      onUpdated(data);
      setDesignDirty(false);
    }
  }

  function resetDesign() {
    setThemeState(resolveTheme(form.theme));
    setBrandingState(resolveBranding(form.branding));
    setLayoutState(form.layout ?? "card");
    setDesignDirty(false);
  }

  async function loadSubmissions() {
    if (submissions !== null) return;
    setLoadingSubmissions(true);
    const { data } = await getFormSubmissions(form.id);
    setSubmissions(data ?? []);
    setLoadingSubmissions(false);
  }

  async function handleSave() {
    setSaving(true);
    const { data, error } = await updateForm(form.id, { name, description: description || undefined, fields });
    setSaving(false);
    if (!error && data) {
      onUpdated(data);
      setEditing(false);
    }
  }

  function handleCancel() {
    setName(form.name);
    setDescription(form.description ?? "");
    setFields(form.fields);
    setEditing(false);
  }

  async function handleToggleActive() {
    setTogglingActive(true);
    const { data } = await updateForm(form.id, { is_active: !form.is_active });
    setTogglingActive(false);
    if (data) onUpdated(data);
  }

  async function handleDelete() {
    const { error } = await deleteForm(form.id);
    if (!error) onDeleted(form.id);
  }

  function copyLink() {
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Form header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg font-semibold h-9"
                placeholder="Form name"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Form description (optional)"
                className="text-sm resize-none h-16"
              />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold truncate">{form.name}</h2>
              {form.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{form.description}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Active toggle */}
          <button
            onClick={handleToggleActive}
            disabled={togglingActive}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              form.is_active
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {togglingActive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : form.is_active ? (
              <ToggleRight className="h-3.5 w-3.5" />
            ) : (
              <ToggleLeft className="h-3.5 w-3.5" />
            )}
            {form.is_active ? "Active" : "Inactive"}
          </button>

          {/* Copy link */}
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 h-8">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy link"}
          </Button>

          {/* Open form */}
          <a href={formUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </Button>
          </a>

          {/* Edit / Save / Cancel */}
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1.5 h-8">
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 h-8">
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-rose-400">Delete?</span>
              <Button variant="destructive" size="sm" onClick={handleDelete} className="h-7 px-2 text-xs">Yes</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 px-2 text-xs">No</Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 h-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Share URL bar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
        <span className="text-xs text-muted-foreground shrink-0">Public URL:</span>
        <span className="flex-1 text-xs font-mono text-foreground/80 truncate">{formUrl}</span>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="form"
        className="flex-1 flex flex-col"
        onValueChange={(v) => { if (v === "submissions") loadSubmissions(); }}
      >
        <TabsList className="bg-muted/50 w-fit">
          <TabsTrigger value="form" className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Form
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2 text-xs">
            <Palette className="h-3.5 w-3.5" />
            Design
          </TabsTrigger>
          <TabsTrigger value="embed" className="gap-2 text-xs">
            <Code2 className="h-3.5 w-3.5" />
            Embed
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-2 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" />
            Submissions
          </TabsTrigger>
        </TabsList>

        {/* Form tab */}
        <TabsContent value="form" className="mt-4 flex-1">
          {editing ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Form Fields</Label>
              <FormBuilder fields={fields} onChange={setFields} />
            </div>
          ) : (
            <FormPreview fields={form.fields} />
          )}
        </TabsContent>

        {/* Design tab */}
        <TabsContent value="design" className="mt-4 flex-1">
          {designDirty && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5">
              <span className="text-xs text-indigo-300">You have unsaved design changes.</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={resetDesign} className="h-7 gap-1.5 text-xs">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button size="sm" onClick={handleSaveDesign} disabled={savingDesign} className="h-7 gap-1.5 text-xs">
                  {savingDesign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save design
                </Button>
              </div>
            </div>
          )}
          <FormDesigner
            form={form}
            theme={theme}
            branding={branding}
            layout={layout}
            onThemeChange={(t) => { setThemeState(t); setDesignDirty(true); }}
            onBrandingChange={(b) => { setBrandingState(b); setDesignDirty(true); }}
            onLayoutChange={(l) => { setLayoutState(l); setDesignDirty(true); }}
          />
        </TabsContent>

        {/* Embed tab */}
        <TabsContent value="embed" className="mt-4 flex-1">
          <EmbedPanel formId={form.id} formUrl={formUrl} />
        </TabsContent>

        {/* Submissions tab */}
        <TabsContent value="submissions" className="mt-4 flex-1">
          {loadingSubmissions ? (
            <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading submissions…</span>
            </div>
          ) : submissions !== null ? (
            <SubmissionsBoard initialSubmissions={submissions} fields={form.fields} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Read-only form preview ─────────────────────────────────────────────────

function FormPreview({ fields }: { fields: HyperFormField[] }) {
  if (fields.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border">
        <div className="text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">No fields yet — click Edit to add fields.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/50 p-5 max-w-lg">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label className="text-sm">
            {field.label || <span className="italic text-muted-foreground">Untitled</span>}
            {field.required && <span className="ml-1 text-rose-400">*</span>}
          </Label>
          <FieldPreviewInput field={field} />
        </div>
      ))}
      <Button size="sm" disabled className="mt-2 opacity-50 cursor-not-allowed">
        Submit (preview)
      </Button>
    </div>
  );
}

function FieldPreviewInput({ field }: { field: HyperFormField }) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder || field.label}
          disabled
          className="resize-none h-20 opacity-60"
        />
      );
    case "select":
      return (
        <select disabled className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm opacity-60">
          <option value="">Select…</option>
          {(field.options ?? []).map((o, i) => (
            <option key={i} value={o}>{o}</option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2 opacity-60">
          <input type="checkbox" disabled className="h-4 w-4" />
          <span className="text-sm text-muted-foreground">{field.placeholder || field.label}</span>
        </div>
      );
    default:
      return (
        <Input
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          placeholder={field.placeholder || field.label}
          disabled
          className="opacity-60"
        />
      );
  }
}
