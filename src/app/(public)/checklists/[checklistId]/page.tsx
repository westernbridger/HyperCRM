"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  Lock,
  ListChecks,
  Check,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getChecklistPublic,
  joinChecklist,
  toggleCheck,
  addChecklistItemPublic,
  type ChecklistWithDetails,
  type ChecklistParticipant,
} from "@/app/actions/checklists";

const STORAGE_KEY_PREFIX = "checklist_participant_";

export default function PublicChecklistPage() {
  const params = useParams();
  const checklistId = params.checklistId as string;

  const [phase, setPhase] = useState<"loading" | "passcode" | "join" | "checklist" | "notfound">("loading");
  const [data, setData] = useState<ChecklistWithDetails | null>(null);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Check for stored participant ID on load
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${checklistId}`);
    const storedName = localStorage.getItem(`${STORAGE_KEY_PREFIX}${checklistId}_name`);
    if (stored && storedName) {
      setParticipantId(stored);
      setDisplayName(storedName);
      // Auto-load checklist with stored passcode
      const storedPasscode = localStorage.getItem(`${STORAGE_KEY_PREFIX}${checklistId}_passcode`);
      if (storedPasscode) {
        loadChecklist(storedPasscode);
        return;
      }
    }
    setPhase("passcode");
  }, [checklistId]);

  const loadChecklist = useCallback(async (pc: string) => {
    setVerifying(true);
    const { data: d, error } = await getChecklistPublic(checklistId, pc);
    setVerifying(false);
    if (error || !d) {
      setPasscodeError(error ?? "Failed to load");
      setPhase("passcode");
      return;
    }
    setData(d);
    // Check if we already have a participant ID stored
    const storedPid = localStorage.getItem(`${STORAGE_KEY_PREFIX}${checklistId}`);
    if (storedPid) {
      setParticipantId(storedPid);
      setPhase("checklist");
    } else {
      setPhase("join");
    }
  }, [checklistId]);

  async function handlePasscodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return;
    setPasscodeError(null);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${checklistId}_passcode`, passcode.trim());
    loadChecklist(passcode.trim());
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !data) return;
    setJoining(true);
    setJoinError(null);
    const { data: result, error } = await joinChecklist(data.id, displayName.trim());
    setJoining(false);
    if (error || !result) {
      setJoinError(error ?? "Failed to join");
      return;
    }
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${checklistId}`, result.participantId);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${checklistId}_name`, displayName.trim());
    setParticipantId(result.participantId);
    setPhase("checklist");
  }

  async function handleToggle(itemId: string) {
    if (!participantId || !data) return;
    setTogglingItemId(itemId);
    const { checked, error } = await toggleCheck(itemId, participantId);
    setTogglingItemId(null);
    if (error) return;

    // Update local state
    if (checked) {
      // Add check — find participant info
      const participant = data.participants.find((p) => p.id === participantId);
      if (participant) {
        setData({
          ...data,
          checks: [
            ...data.checks,
            { id: `${itemId}-${participantId}`, item_id: itemId, participant_id: participantId, checked_at: new Date().toISOString(), participant },
          ],
        });
      }
    } else {
      // Remove check
      setData({
        ...data,
        checks: data.checks.filter((c) => !(c.item_id === itemId && c.participant_id === participantId)),
      });
    }
  }

  async function handleAddItem() {
    if (!data || !participantId || !newItemLabel.trim()) return;
    setAddingItem(true);
    const { data: item, error } = await addChecklistItemPublic(data.id, newItemLabel.trim(), newItemQty.trim() || null, participantId);
    setAddingItem(false);
    if (error || !item) return;
    setData({ ...data, items: [...data.items, item] });
    setNewItemLabel("");
    setNewItemQty("");
  }

  // Group checks by item
  const checksByItem = new Map<string, ChecklistParticipant[]>();
  if (data) {
    for (const check of data.checks) {
      const arr = checksByItem.get(check.item_id) ?? [];
      if (check.participant) arr.push(check.participant);
      checksByItem.set(check.item_id, arr);
    }
  }

  // My checked items
  const myCheckedItems = new Set<string>();
  if (data && participantId) {
    for (const check of data.checks) {
      if (check.participant_id === participantId) {
        myCheckedItems.add(check.item_id);
      }
    }
  }

  // ── Render phases ──

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h1 className="text-lg font-semibold">Checklist not found</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This checklist doesn&apos;t exist or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "passcode") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <Lock className="h-8 w-8 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold">Enter Passcode</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the passcode provided by the organizer to access this checklist.
            </p>
          </div>
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="e.g. BBQ2024"
                autoFocus
                className="text-center text-lg font-medium tracking-wider"
              />
            </div>
            {passcodeError && (
              <p className="text-sm text-destructive text-center">{passcodeError}</p>
            )}
            <Button type="submit" disabled={verifying || !passcode.trim()} className="w-full gap-2">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {verifying ? "Verifying…" : "Access Checklist"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (phase === "join") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <ListChecks className="h-8 w-8 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold">{data?.name}</h1>
            {data?.description && (
              <p className="text-sm text-muted-foreground mt-1">{data.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              Enter your name to join the checklist. This will be shown when you check items.
            </p>
          </div>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. John Smith"
                autoFocus
              />
            </div>
            {joinError && (
              <p className="text-sm text-destructive text-center">{joinError}</p>
            )}
            <Button type="submit" disabled={joining || !displayName.trim()} className="w-full gap-2">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {joining ? "Joining…" : "Join Checklist"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main checklist view ──
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <ListChecks className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{data.name}</h1>
              {data.description && (
                <p className="text-sm text-muted-foreground">{data.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: data.participants.find((p) => p.id === participantId)?.avatar_color ?? "#6366f1" }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-muted-foreground">
              You&apos;re checked in as <span className="font-medium text-foreground">{displayName}</span>
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {data.items.map((item, i) => {
              const checkers = checksByItem.get(item.id) ?? [];
              const isCheckedByMe = myCheckedItems.has(item.id);
              const isToggling = togglingItemId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    isCheckedByMe
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-card"
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggle(item.id)}
                    disabled={isToggling}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                      isCheckedByMe
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/30 hover:border-indigo-400"
                    )}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCheckedByMe ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </button>

                  {/* Label + quantity + custom fields */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", isCheckedByMe && "line-through text-muted-foreground")}>
                        {item.label}
                      </span>
                      {item.quantity && (
                        <span className="text-xs text-muted-foreground">qty: {item.quantity}</span>
                      )}
                    </div>
                    {item.fields && item.fields.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {item.fields.map((f) => (
                          <span key={f.id} className="text-[11px] text-muted-foreground">
                            <span className="text-muted-foreground/60">{f.label}:</span>{" "}
                            <span className="text-foreground/80">{f.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Checkers */}
                  <div className="flex items-center gap-1.5">
                    {checkers.length > 0 ? (
                      <>
                        <div className="flex -space-x-2">
                          {checkers.slice(0, 5).map((p) => (
                            <div
                              key={p.id}
                              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white"
                              style={{ backgroundColor: p.avatar_color }}
                              title={p.display_name}
                            >
                              {p.display_name.slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        {checkers.length > 5 && (
                          <span className="text-xs text-muted-foreground">+{checkers.length - 5}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">Unchecked</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {data.items.length === 0 && (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">No items yet.</p>
            </div>
          )}
        </div>

        {/* Add item (if editing allowed) */}
        {data.allow_editing && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3">
            <Input
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              placeholder="Add a new item…"
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
            />
            <Input
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              placeholder="qty"
              className="h-8 text-sm w-20"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
            />
            <Button
              size="sm"
              onClick={handleAddItem}
              disabled={addingItem || !newItemLabel.trim()}
              className="h-8 gap-1.5"
            >
              {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
        )}

        {/* Participants summary */}
        {data.participants.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-card/50 p-4">
            <p className="text-sm font-medium mb-3">
              Participants ({data.participants.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {data.participants.map((p) => {
                const checkCount = data.checks.filter((c) => c.participant_id === p.id).length;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5",
                      p.id === participantId ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-secondary/50"
                    )}
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: p.avatar_color }}
                    >
                      {p.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium">
                      {p.display_name}
                      {p.id === participantId && " (You)"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{checkCount} checks</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
