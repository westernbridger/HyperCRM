"use client";

import { useState, useMemo, useTransition } from "react";
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
  LayoutGrid,
  Globe,
  Calendar,
  Building2,
  Hash,
  Loader2,
  GripVertical,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateContact } from "@/app/actions/contacts";
import type { Contact } from "@/app/actions/contacts";

// ── Column definitions ────────────────────────────────────

type ColumnDef = {
  id: string;
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass: string;
  Icon: React.ElementType;
};

const STATUS_COLUMNS: ColumnDef[] = [
  {
    id: "Lead",
    label: "New Lead",
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-500/10 border-indigo-500/20",
    dotClass: "bg-indigo-400",
    Icon: Target,
  },
  {
    id: "Prospect",
    label: "Prospect",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10 border-amber-500/20",
    dotClass: "bg-amber-400",
    Icon: UserCheck,
  },
  {
    id: "Customer",
    label: "Customer",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
    dotClass: "bg-emerald-400",
    Icon: CheckCircle2,
  },
  {
    id: "Churned",
    label: "Churned",
    colorClass: "text-rose-400",
    bgClass: "bg-rose-500/10 border-rose-500/20",
    dotClass: "bg-rose-400",
    Icon: XCircle,
  },
];

const CAMPAIGN_PALETTE: Pick<ColumnDef, "colorClass" | "bgClass" | "dotClass">[] = [
  { colorClass: "text-blue-400",   bgClass: "bg-blue-500/10 border-blue-500/20",     dotClass: "bg-blue-400" },
  { colorClass: "text-violet-400", bgClass: "bg-violet-500/10 border-violet-500/20", dotClass: "bg-violet-400" },
  { colorClass: "text-cyan-400",   bgClass: "bg-cyan-500/10 border-cyan-500/20",     dotClass: "bg-cyan-400" },
  { colorClass: "text-pink-400",   bgClass: "bg-pink-500/10 border-pink-500/20",     dotClass: "bg-pink-400" },
  { colorClass: "text-teal-400",   bgClass: "bg-teal-500/10 border-teal-500/20",     dotClass: "bg-teal-400" },
];

// ── Helpers ───────────────────────────────────────────────

function getInitials(c: Contact) {
  return `${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getCampaign(c: Contact): string | null {
  return (c.custom_fields?.campaign_name as string) ?? null;
}

// ── Draggable Card ────────────────────────────────────────

function LeadCard({
  contact,
  isGhost,
}: {
  contact: Contact;
  isGhost?: boolean;
}) {
  const campaign = getCampaign(contact);
  const isMetaLead = !!contact.custom_fields?.meta_form_id;
  const fieldCount = Object.keys(contact.custom_fields ?? {}).length;

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
          {getInitials(contact)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">
            {contact.first_name} {contact.last_name}
          </p>
          {contact.company && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
            </div>
          )}
        </div>
      </div>

      {/* Campaign badge */}
      {campaign && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1">
          {isMetaLead && <Globe className="h-3 w-3 shrink-0 text-blue-400" />}
          <span className="text-[11px] text-blue-400 font-medium truncate">{campaign}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span className="text-[11px]">{formatDate(contact.created_at)}</span>
        </div>
        {fieldCount > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5">
            <Hash className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{fieldCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableLeadCard({ contact }: { contact: Contact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
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
      <LeadCard contact={contact} isGhost={isDragging} />
    </motion.div>
  );
}

// ── Droppable Column ──────────────────────────────────────

function PipelineColumn({
  col,
  contacts,
  activeId,
}: {
  col: ColumnDef;
  contacts: Contact[];
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const Icon = col.Icon;

  return (
    <div className="flex w-[17rem] shrink-0 flex-col gap-2">
      {/* Header */}
      <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5", col.bgClass)}>
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", col.dotClass)} />
          <Icon className={cn("h-3.5 w-3.5", col.colorClass)} />
          <span className={cn("text-sm font-semibold", col.colorClass)}>{col.label}</span>
        </div>
        <span className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
          col.bgClass, col.colorClass
        )}>
          {contacts.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl p-2 min-h-[8rem] transition-all duration-150",
          isOver
            ? "bg-indigo-500/5 ring-2 ring-inset ring-indigo-500/30"
            : "bg-secondary/20"
        )}
      >
        <AnimatePresence initial={false}>
          {contacts.map((c) => (
            <DraggableLeadCard key={c.id} contact={c} />
          ))}
        </AnimatePresence>

        {contacts.length === 0 && !isOver && (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-xs text-muted-foreground/40 select-none">Drop leads here</p>
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

// ── Main Board ────────────────────────────────────────────

export type GroupBy = "status" | "campaign";

export function PipelineBoard({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Derive columns
  const columns = useMemo<ColumnDef[]>(() => {
    if (groupBy === "status") return STATUS_COLUMNS;
    const names = [...new Set(contacts.map(getCampaign).filter((n): n is string => !!n))];
    if (names.length === 0) return STATUS_COLUMNS;
    return names.map((name, i) => ({
      id: name,
      label: name,
      Icon: Globe,
      ...CAMPAIGN_PALETTE[i % CAMPAIGN_PALETTE.length],
    }));
  }, [groupBy, contacts]);

  // Group contacts into columns
  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = Object.fromEntries(columns.map((c) => [c.id, []]));
    for (const contact of contacts) {
      const key = groupBy === "status" ? contact.status : (getCampaign(contact) ?? "");
      if (key in map) map[key].push(contact);
    }
    return map;
  }, [contacts, columns, groupBy]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? null,
    [activeId, contacts]
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const id = active.id as string;
    const targetCol = over.id as string;
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return;

    const currentKey = groupBy === "status" ? contact.status : (getCampaign(contact) ?? "");
    if (currentKey === targetCol) return;

    if (groupBy === "status") {
      const newStatus = targetCol as Contact["status"];
      // Optimistic
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
      startTransition(async () => {
        const { error } = await updateContact(id, { status: newStatus }, contact.status);
        if (error) {
          setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: contact.status } : c)));
        }
      });
    } else {
      const merged = { ...contact.custom_fields, campaign_name: targetCol };
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, custom_fields: merged } : c)));
      startTransition(async () => {
        const { error } = await updateContact(id, { custom_fields: merged });
        if (error) {
          setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, custom_fields: contact.custom_fields } : c)));
        }
      });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold">Pipeline Board</h3>
        <div className="flex items-center gap-3">
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </div>
          )}
          <span className="text-xs text-muted-foreground font-medium hidden sm:block">Group by</span>
          <div className="flex rounded-lg border border-border bg-background p-0.5 gap-0.5">
            <button
              onClick={() => setGroupBy("status")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                groupBy === "status"
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Status
            </button>
            <button
              onClick={() => setGroupBy("campaign")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                groupBy === "campaign"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
          {columns.map((col) => (
            <PipelineColumn
              key={col.id}
              col={col}
              contacts={grouped[col.id] ?? []}
              activeId={activeId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeContact && (
            <div className="w-[17rem] rotate-1 scale-105 opacity-95 shadow-2xl">
              <LeadCard contact={activeContact} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
