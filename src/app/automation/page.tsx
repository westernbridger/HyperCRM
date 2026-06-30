"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Workflow as WorkflowIcon,
  Zap,
  Mail,
  Users,
  Tag,
  FileText,
  UserPlus,
  Play,
  Pause,
  Trash2,
  Loader2,
  ArrowRight,
  Clock,
  CheckCircle,
  Pencil,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflowStatus,
  type WorkflowInput,
} from "@/app/actions/automation";
import { getSegments } from "@/app/actions/segments";
import type {
  Workflow,
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowStatus,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const TRIGGER_OPTIONS: {
  value: WorkflowTriggerType;
  label: string;
  icon: typeof UserPlus;
  desc: string;
}[] = [
  { value: "contact_created", label: "Contact Created", icon: UserPlus, desc: "When a new contact is added" },
  { value: "contact_status_changed", label: "Status Changed", icon: Tag, desc: "When a contact's status changes" },
  { value: "contact_added_to_segment", label: "Added to Segment", icon: Users, desc: "When a contact joins a segment" },
  { value: "contact_updated", label: "Contact Updated", icon: Pencil, desc: "When any contact field is updated" },
];

const ACTION_OPTIONS: {
  value: WorkflowActionType;
  label: string;
  icon: typeof Mail;
  desc: string;
}[] = [
  { value: "send_email", label: "Send Email", icon: Mail, desc: "Send an automated email" },
  { value: "add_to_segment", label: "Add to Segment", icon: Users, desc: "Add contact to a segment" },
  { value: "update_status", label: "Update Status", icon: Tag, desc: "Change contact status" },
  { value: "add_tag", label: "Add Tag", icon: Tag, desc: "Tag the contact" },
  { value: "create_activity", label: "Log Activity", icon: FileText, desc: "Create a note/activity entry" },
];

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

type Segment = { id: string; name: string };

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: wfData }, { data: segData }] = await Promise.all([
      getWorkflows(),
      getSegments(),
    ]);
    setWorkflows(wfData ?? []);
    setSegments(
      (segData ?? []).map((s: any) => ({ id: s.id, name: s.name }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleNew() {
    setEditing(null);
    setShowEditor(true);
  }

  function handleEdit(wf: Workflow) {
    setEditing(wf);
    setShowEditor(true);
  }

  async function handleToggle(wf: Workflow) {
    const { data } = await toggleWorkflowStatus(wf.id);
    if (data) {
      setWorkflows((prev) => prev.map((w) => (w.id === data.id ? data : w)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteWorkflow(deleteTarget.id);
    setDeleting(false);
    setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function handleSaved(wf: Workflow) {
    setWorkflows((prev) => {
      const idx = prev.findIndex((w) => w.id === wf.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = wf;
        return next;
      }
      return [wf, ...prev];
    });
    setShowEditor(false);
    setEditing(null);
  }

  const activeCount = workflows.filter((w) => w.status === "active").length;
  const totalRuns = workflows.reduce((sum, w) => sum + (w.run_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground">
            Trigger → Action workflows that run automatically.
          </p>
        </div>
        <Button className="gap-2" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          New Workflow
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <MetricCard icon={WorkflowIcon} label="Total Workflows" value={workflows.length} />
        <MetricCard icon={Play} label="Active" value={activeCount} accent="emerald" />
        <MetricCard icon={Zap} label="Total Runs" value={totalRuns} accent="amber" />
        <MetricCard icon={Clock} label="Last Run" value={workflows.find((w) => w.last_run_at)?.last_run_at ? "Recently" : "—"} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <WorkflowIcon className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold">No workflows yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first automation to save time. Pick a trigger, choose an action, and let HyperCRM handle the rest.
          </p>
          <Button onClick={handleNew} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {workflows.map((wf) => {
              const trigger = TRIGGER_OPTIONS.find((t) => t.value === wf.trigger_type);
              const action = ACTION_OPTIONS.find((a) => a.value === wf.action_type);
              const TriggerIcon = trigger?.icon ?? Zap;
              const ActionIcon = action?.icon ?? Zap;
              return (
                <motion.div
                  key={wf.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group relative rounded-xl border border-border bg-card p-4 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      STATUS_STYLES[wf.status]
                    )}>
                      {wf.status === "active" && <CheckCircle className="h-2.5 w-2.5" />}
                      {wf.status === "paused" && <Pause className="h-2.5 w-2.5" />}
                      {wf.status}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(wf)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(wf)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold truncate">{wf.name}</h3>
                  {wf.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{wf.description}</p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2 py-1.5">
                      <TriggerIcon className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="text-[11px] font-medium">{trigger?.label ?? wf.trigger_type}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <div className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2 py-1.5">
                      <ActionIcon className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-[11px] font-medium">{action?.label ?? wf.action_type}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {wf.run_count > 0 ? wf.run_count + " run" + (wf.run_count !== 1 ? "s" : "") : "No runs yet"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handleToggle(wf)}
                    >
                      {wf.status === "active" ? (
                        <><Pause className="h-3 w-3" /> Pause</>
                      ) : (
                        <><Play className="h-3 w-3" /> Activate</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {showEditor && (
        <WorkflowEditor
          open={showEditor}
          onOpenChange={(o) => { setShowEditor(o); if (!o) setEditing(null); }}
          editing={editing}
          segments={segments}
          onSaved={handleSaved}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete workflow?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Zap;
  label: string;
  value: string | number;
  accent?: "emerald" | "amber";
}) {
  const accentColor =
    accent === "emerald" ? "text-emerald-400" :
    accent === "amber" ? "text-amber-400" :
    "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", accentColor)} />
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function WorkflowEditor({
  open,
  onOpenChange,
  editing,
  segments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Workflow | null;
  segments: Segment[];
  onSaved: (wf: Workflow) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("contact_created");
  const [actionType, setActionType] = useState<WorkflowActionType>("send_email");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setTriggerType(editing.trigger_type);
      setActionType(editing.action_type);
      setTriggerConfig(editing.trigger_config ?? {});
      setActionConfig(editing.action_config ?? {});
    } else {
      setName("");
      setDescription("");
      setTriggerType("contact_created");
      setActionType("send_email");
      setTriggerConfig({});
      setActionConfig({});
    }
    setError(null);
  }, [editing, open]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);

    const input: WorkflowInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      status: editing?.status ?? "draft",
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
    };

    const { data, error: saveError } = editing
      ? await updateWorkflow(editing.id, input)
      : await createWorkflow(input);

    setSaving(false);

    if (saveError || !data) {
      setError(saveError ?? "Failed to save workflow");
      return;
    }

    onSaved(data);
  }

  const trigger = TRIGGER_OPTIONS.find((t) => t.value === triggerType);
  const action = ACTION_OPTIONS.find((a) => a.value === actionType);
  const TriggerIcon = trigger?.icon ?? Zap;
  const ActionIcon = action?.icon ?? Zap;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WorkflowIcon className="h-4 w-4 text-amber-400" />
            {editing ? "Edit Workflow" : "New Workflow"}
          </DialogTitle>
          <DialogDescription>
            Define a trigger and an action. When the trigger fires, the action runs automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Workflow Name <span className="text-rose-400">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome new leads"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional short description"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-500/30">
                <TriggerIcon className="h-5 w-5 text-indigo-400" />
              </div>
              <span className="text-[10px] text-muted-foreground">Trigger</span>
            </div>
            <div className="flex-1 relative h-px bg-border">
              <ArrowRight className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground bg-card rounded-full" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30">
                <ActionIcon className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-[10px] text-muted-foreground">Action</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">When this happens…</Label>
            <Select
              value={triggerType}
              onValueChange={(v) => { setTriggerType(v as WorkflowTriggerType); setTriggerConfig({}); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <t.icon className="h-4 w-4 text-indigo-400" />
                      <div>
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{t.desc}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {triggerType === "contact_status_changed" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">From Status (optional)</Label>
                  <Select
                    value={triggerConfig.from_status ?? "__any"}
                    onValueChange={(v) => setTriggerConfig((p) => ({ ...p, from_status: v === "__any" ? undefined : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any status</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Prospect">Prospect</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                      <SelectItem value="Churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To Status (optional)</Label>
                  <Select
                    value={triggerConfig.to_status ?? "__any"}
                    onValueChange={(v) => setTriggerConfig((p) => ({ ...p, to_status: v === "__any" ? undefined : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any status</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Prospect">Prospect</SelectItem>
                      <SelectItem value="Customer">Customer</SelectItem>
                      <SelectItem value="Churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {triggerType === "contact_added_to_segment" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Segment</Label>
                <Select
                  value={triggerConfig.segment_id ?? "__any"}
                  onValueChange={(v) => setTriggerConfig((p) => ({ ...p, segment_id: v === "__any" ? undefined : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Any segment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">Any segment</SelectItem>
                    {segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Do this…</Label>
            <Select
              value={actionType}
              onValueChange={(v) => { setActionType(v as WorkflowActionType); setActionConfig({}); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    <div className="flex items-center gap-2">
                      <a.icon className="h-4 w-4 text-amber-400" />
                      <div>
                        <span className="text-sm font-medium">{a.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{a.desc}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {actionType === "send_email" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Subject</Label>
                  <Input
                    value={actionConfig.subject ?? ""}
                    onChange={(e) => setActionConfig((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Welcome to our platform!"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Body (HTML)</Label>
                  <Textarea
                    value={actionConfig.body ?? ""}
                    onChange={(e) => setActionConfig((p) => ({ ...p, body: e.target.value }))}
                    placeholder="<p>Hi {{contact.first_name | default: &quot;there&quot;}}, welcome aboard!</p>"
                    rows={5}
                    className="font-mono text-xs"
                  />
                </div>

                {/* Variable picker */}
                <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    Insert variables — click to add to body
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "First Name", token: "{{contact.first_name}}" },
                      { label: "Last Name", token: "{{contact.last_name}}" },
                      { label: "Email", token: "{{contact.email}}" },
                      { label: "Phone", token: "{{contact.phone}}" },
                      { label: "Company", token: "{{contact.company}}" },
                      { label: "Status", token: "{{contact.status}}" },
                      { label: "Workspace", token: "{{workspace.name}}" },
                    ].map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => setActionConfig((p) => ({ ...p, body: (p.body ?? "") + ` ${v.token}` }))}
                        className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fallback guidance */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Fallback values — recommended for automations
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Since you don&apos;t know who will trigger this workflow, add fallbacks for fields that might be empty.
                    Use the pipe syntax: <code className="font-mono text-amber-300">{"{{contact.first_name | default: \"there\"}}"}</code>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { label: "First Name + fallback", token: '{{contact.first_name | default: "there"}}' },
                      { label: "Company + fallback", token: '{{contact.company | default: "your team"}}' },
                      { label: "Phone + fallback", token: '{{contact.phone | default: "N/A"}}' },
                    ].map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => setActionConfig((p) => ({ ...p, body: (p.body ?? "") + ` ${v.token}` }))}
                        className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] font-mono text-amber-300 hover:bg-amber-500/10 transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Your workspace email signature is automatically appended to every automated email.
                </p>
              </div>
            )}

            {actionType === "add_to_segment" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Target Segment</Label>
                <Select
                  value={actionConfig.segment_id ?? ""}
                  onValueChange={(v) => setActionConfig((p) => ({ ...p, segment_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select a segment" /></SelectTrigger>
                  <SelectContent>
                    {segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {actionType === "update_status" && (
              <div className="space-y-1.5">
                <Label className="text-xs">New Status</Label>
                <Select
                  value={actionConfig.status ?? ""}
                  onValueChange={(v) => setActionConfig((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {actionType === "add_tag" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tag</Label>
                <Input
                  value={actionConfig.tag ?? ""}
                  onChange={(e) => setActionConfig((p) => ({ ...p, tag: e.target.value }))}
                  placeholder="e.g. vip, newsletter, follow-up"
                />
              </div>
            )}

            {actionType === "create_activity" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Activity Type</Label>
                  <Select
                    value={actionConfig.type ?? "note"}
                    onValueChange={(v) => setActionConfig((p) => ({ ...p, type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={actionConfig.title ?? ""}
                    onChange={(e) => setActionConfig((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Automated follow-up"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Content</Label>
                  <Textarea
                    value={actionConfig.content ?? ""}
                    onChange={(e) => setActionConfig((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Activity details…"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
