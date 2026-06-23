"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  UserCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Hash,
  GripVertical,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HyperFormSubmission } from "@/app/actions/forms";
import type { HyperFormField } from "@/lib/supabase/database.types";
import { updateSubmissionStatus } from "@/app/actions/forms";

type Status = HyperFormSubmission["status"];

type ColumnDef = {
  id: Status;
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass: string;
  Icon: React.ElementType;
};

const COLUMNS: ColumnDef[] = [
  { id: "Lead",     label: "New Lead",  colorClass: "text-indigo-400",  bgClass: "bg-indigo-500/10 border-indigo-500/20",   dotClass: "bg-indigo-400",  Icon: Target },
  { id: "Prospect", label: "Prospect",  colorClass: "text-amber-400",   bgClass: "bg-amber-500/10 border-amber-500/20",     dotClass: "bg-amber-400",   Icon: UserCheck },
  { id: "Customer", label: "Customer",  colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20", dotClass: "bg-emerald-400", Icon: CheckCircle2 },
  { id: "Churned",  label: "Churned",   colorClass: "text-rose-400",    bgClass: "bg-rose-500/10 border-rose-500/20",       dotClass: "bg-rose-400",    Icon: XCircle },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDisplayName(answers: Record<string, any>, fields: HyperFormField[]): string {
  const firstField = fields.find((f) => f.maps_to === "first_name");
  const lastField  = fields.find((f) => f.maps_to === "last_name");
  const emailField = fields.find((f) => f.maps_to === "email");
  const first = firstField ? answers[firstField.id] : null;
  const last  = lastField  ? answers[lastField.id]  : null;
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (emailField && answers[emailField.id]) return answers[emailField.id];
  return "Anonymous";
}

function getEmail(answers: Record<string, any>, fields: HyperFormField[]): string | null {
  const f = fields.find((f) => f.maps_to === "email");
  return f ? answers[f.id] ?? null : null;
}

// ── Submission Card ────────────────────────────────────────────────────────

function SubmissionCard({
  submission,
  fields,
  isGhost,
}: {
  submission: HyperFormSubmission;
  fields: HyperFormField[];
  isGhost?: boolean;
}) {
  const name  = getDisplayName(submission.answers, fields);
  const email = getEmail(submission.answers, fields);
  const answerCount = Object.keys(submission.answers).length;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-card p-3.5 shadow-sm",
        "hover:border-indigo-500/40 hover:shadow-md transition-all duration-200",
        isGhost && "opacity-40"
      )}
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Avatar + name */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{name}</p>
          {email && <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>}
        </div>
      </div>

      {/* Source badge */}
      <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-1">
        <FileText className="h-3 w-3 shrink-0 text-indigo-400" />
        <span className="text-[11px] text-indigo-400 font-medium">HyperForm</span>
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span className="text-[11px]">{formatDate(submission.submitted_at)}</span>
        </div>
        {answerCount > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5">
            <Hash className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{answerCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  submission,
  fields,
}: {
  submission: HyperFormSubmission;
  fields: HyperFormField[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: submission.id,
    data: { submission },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <SubmissionCard submission={submission} fields={fields} isGhost={isDragging} />
    </motion.div>
  );
}

// ── Droppable Column ───────────────────────────────────────────────────────

function SubmissionColumn({
  col,
  submissions,
  fields,
  activeId,
}: {
  col: ColumnDef;
  submissions: HyperFormSubmission[];
  fields: HyperFormField[];
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const Icon = col.Icon;

  return (
    <div className="flex w-[17rem] shrink-0 flex-col gap-2">
      <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5", col.bgClass)}>
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", col.dotClass)} />
          <Icon className={cn("h-3.5 w-3.5", col.colorClass)} />
          <span className={cn("text-sm font-semibold", col.colorClass)}>{col.label}</span>
        </div>
        <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold", col.bgClass, col.colorClass)}>
          {submissions.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl p-2 min-h-[8rem] transition-all duration-150",
          isOver ? "bg-indigo-500/5 ring-2 ring-inset ring-indigo-500/30" : "bg-secondary/20"
        )}
      >
        <AnimatePresence initial={false}>
          {submissions.map((s) => (
            <DraggableCard key={s.id} submission={s} fields={fields} />
          ))}
        </AnimatePresence>

        {submissions.length === 0 && !isOver && (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-xs text-muted-foreground/40 select-none">Drop submissions here</p>
          </div>
        )}

        {isOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 p-4 flex items-center justify-center"
          >
            <p className="text-xs text-indigo-400 font-medium">Release to move</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Main Board ─────────────────────────────────────────────────────────────

interface SubmissionsBoardProps {
  initialSubmissions: HyperFormSubmission[];
  fields: HyperFormField[];
}

export function SubmissionsBoard({ initialSubmissions, fields }: SubmissionsBoardProps) {
  const [submissions, setSubmissions] = useState<HyperFormSubmission[]>(initialSubmissions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const grouped = useMemo(() => {
    const map: Record<Status, HyperFormSubmission[]> = {
      Lead: [], Prospect: [], Customer: [], Churned: [],
    };
    for (const s of submissions) {
      map[s.status].push(s);
    }
    return map;
  }, [submissions]);

  const activeSubmission = submissions.find((s) => s.id === activeId) ?? null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const id = active.id as string;
    const newStatus = over.id as Status;
    const sub = submissions.find((s) => s.id === id);
    if (!sub || sub.status === newStatus) return;

    // Optimistic update
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );

    setSaving(true);
    const { error } = await updateSubmissionStatus(id, newStatus);
    setSaving(false);

    if (error) {
      // Rollback
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: sub.status } : s))
      );
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
        <div className="text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No submissions yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Share the form link to start collecting responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {saving && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {COLUMNS.map((col) => (
            <SubmissionColumn
              key={col.id}
              col={col}
              submissions={grouped[col.id]}
              fields={fields}
              activeId={activeId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeSubmission && (
            <div className="w-[17rem] rotate-1 scale-105 opacity-95 shadow-2xl">
              <SubmissionCard submission={activeSubmission} fields={fields} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
