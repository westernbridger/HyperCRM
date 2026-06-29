"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Trash2,
  Users,
  Upload,
  Loader2,
  Mail,
  X,
  Pencil,
  FolderPlus,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  getSegments,
  getSegmentContacts,
  createSegment,
  updateSegment,
  deleteSegment,
  addContactsToSegment,
  removeContactFromSegment,
  addContactsByEmail,
  importCsvToSegment,
  SEGMENT_FIELDS,
  SEGMENT_OPERATORS,
  type Segment,
  type SegmentContact,
  type SegmentConditions,
  type SegmentConditionItem,
  type SegmentOperator,
} from "@/app/actions/segments";
import { getContacts, type UiContact } from "@/lib/data/contacts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ── Condition Builder ────────────────────────────────────────────────────────

function ConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: SegmentConditions | null;
  onChange: (c: SegmentConditions | null) => void;
}) {
  const enabled = conditions !== null;
  const items = conditions?.items ?? [];
  const logic = conditions?.logic ?? "and";

  function toggleEnabled() {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ logic: "and", items: [] });
    }
  }

  function addCondition() {
    const newItem: SegmentConditionItem = {
      id: crypto.randomUUID(),
      field: "first_name",
      operator: "contains",
      value: "",
    };
    onChange({ logic, items: [...items, newItem] });
  }

  function updateCondition(id: string, updates: Partial<SegmentConditionItem>) {
    onChange({
      logic,
      items: items.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    });
  }

  function removeCondition(id: string) {
    onChange({
      logic,
      items: items.filter((it) => it.id !== id),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Auto-match conditions
        </Label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} className="rounded" />
          Enabled
        </label>
      </div>
      {enabled && (
        <>
          <p className="text-xs text-muted-foreground">
            Contacts matching these conditions will be automatically added to this segment. New contacts that match will be added automatically.
          </p>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Match</span>
              <select
                value={logic}
                onChange={(e) => onChange({ logic: e.target.value as "and" | "or", items })}
                className="h-7 rounded border border-border bg-card px-2 text-xs"
              >
                <option value="and">ALL (AND)</option>
                <option value="or">ANY (OR)</option>
              </select>
              <span className="text-xs text-muted-foreground">of the following:</span>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => {
              const fieldDef = SEGMENT_FIELDS.find((f) => f.key === item.field);
              const opDef = SEGMENT_OPERATORS.find((o) => o.key === item.operator);
              return (
                <div key={item.id} className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={item.field}
                      onChange={(e) => updateCondition(item.id, { field: e.target.value })}
                      className="h-7 flex-1 rounded border border-border bg-card px-2 text-xs"
                    >
                      {SEGMENT_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeCondition(item.id)}
                      className="text-muted-foreground hover:text-red-400 p-0.5 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.operator}
                      onChange={(e) => updateCondition(item.id, { operator: e.target.value as SegmentOperator })}
                      className="h-7 flex-1 rounded border border-border bg-card px-2 text-xs"
                    >
                      {SEGMENT_OPERATORS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {opDef?.needsValue && (
                    <Input
                      value={item.value}
                      onChange={(e) => updateCondition(item.id, { value: e.target.value })}
                      placeholder="Value…"
                      className="h-7 text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" onClick={addCondition} className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" />
            Add condition
          </Button>
        </>
      )}
    </div>
  );
}

export function SegmentsTab() {
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [segmentContacts, setSegmentContacts] = useState<SegmentContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Create/Edit segment dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [segName, setSegName] = useState("");
  const [segDesc, setSegDesc] = useState("");
  const [segColor, setSegColor] = useState("#6366f1");
  const [segConditions, setSegConditions] = useState<SegmentConditions | null>(null);
  const [saving, setSaving] = useState(false);

  // Add contacts dialog
  const [addOpen, setAddOpen] = useState(false);
  const [allContacts, setAllContacts] = useState<UiContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [loadingAllContacts, setLoadingAllContacts] = useState(false);

  // Add by email dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [addingEmails, setAddingEmails] = useState(false);

  // CSV import
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadSegments = useCallback(async () => {
    setLoading(true);
    const { data } = await getSegments();
    setSegments(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const openSegment = useCallback(async (seg: Segment) => {
    setSelectedSegment(seg);
    setLoadingContacts(true);
    const { data } = await getSegmentContacts(seg.id);
    setSegmentContacts(data ?? []);
    setLoadingContacts(false);
  }, []);

  const handleCreate = async () => {
    if (!segName.trim()) return;
    setSaving(true);
    const { segmentId, error } = await createSegment({
      name: segName,
      description: segDesc,
      color: segColor,
      conditions: segConditions,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Segment created", description: `${segName} has been created.` });
    setSegName("");
    setSegDesc("");
    setSegColor("#6366f1");
    setSegConditions(null);
    setCreateOpen(false);
    loadSegments();
  };

  const handleUpdate = async () => {
    if (!selectedSegment || !segName.trim()) return;
    setSaving(true);
    const { error } = await updateSegment(selectedSegment.id, {
      name: segName,
      description: segDesc,
      color: segColor,
      conditions: segConditions,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Segment updated" });
    setEditOpen(false);
    loadSegments();
  };

  const handleDelete = async () => {
    if (!selectedSegment) return;
    setDeleting(true);
    const { error } = await deleteSegment(selectedSegment.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Segment deleted", description: `${selectedSegment.name} has been deleted.` });
    setDeleteOpen(false);
    setSelectedSegment(null);
    setSegmentContacts([]);
    loadSegments();
  };

  const loadAllContacts = useCallback(async () => {
    setLoadingAllContacts(true);
    const data = await getContacts();
    setAllContacts(data ?? []);
    setLoadingAllContacts(false);
  }, []);

  const handleAddContacts = async () => {
    if (!selectedSegment || selectedContactIds.size === 0) return;
    setSaving(true);
    const { added, error } = await addContactsToSegment(
      selectedSegment.id,
      Array.from(selectedContactIds)
    );
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Contacts added", description: `${added} contact(s) added to ${selectedSegment.name}.` });
    setSelectedContactIds(new Set());
    setAddOpen(false);
    openSegment(selectedSegment);
    loadSegments();
  };

  const handleRemoveContact = async (contactId: string, contactName: string) => {
    if (!selectedSegment) return;
    const { error } = await removeContactFromSegment(selectedSegment.id, contactId);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Contact removed", description: `${contactName} removed from ${selectedSegment.name}.` });
    setSegmentContacts((prev) => prev.filter((c) => c.id !== contactId));
    loadSegments();
  };

  const handleAddEmails = async () => {
    if (!selectedSegment || !emailText.trim()) return;
    setAddingEmails(true);
    const lines = emailText
      .split(/[\n,;]/)
      .map((l) => l.trim())
      .filter(Boolean);
    const entries = lines.map((line) => {
      const email = line.match(/<([^>]+)>/)?.[1] ?? line;
      const name = line.replace(/<[^>]+>/, "").trim();
      const parts = name.split(/\s+/);
      return {
        email,
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" ") || "",
      };
    });
    const { created, added, error } = await addContactsByEmail(selectedSegment.id, entries);
    setAddingEmails(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({
      title: "Contacts added",
      description: `${created} new contact(s) created, ${added} total added to ${selectedSegment.name}.`,
    });
    setEmailText("");
    setEmailOpen(false);
    openSegment(selectedSegment);
    loadSegments();
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSegment) return;
    setImporting(true);
    const text = await file.text();
    const { created, added, errors, error } = await importCsvToSegment(selectedSegment.id, text);
    setImporting(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (error) {
      toast({ title: "Import error", description: error, variant: "destructive" });
      return;
    }
    toast({
      title: "CSV imported",
      description: `${created} new, ${added} added to ${selectedSegment.name}. ${errors.length} warning(s).`,
    });
    openSegment(selectedSegment);
    loadSegments();
  };

  const filteredContacts = allContacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q)
    );
  });

  // ── Segment detail view ─────────────────────────────────────────────────────
  if (selectedSegment) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSegment(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: selectedSegment.color || "#6366f1" }}
            />
            <div>
              <h2 className="text-lg font-semibold">{selectedSegment.name}</h2>
              {selectedSegment.description && (
                <p className="text-xs text-muted-foreground">{selectedSegment.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="ml-2">
              {segmentContacts.length} contacts
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                setSegName(selectedSegment.name);
                setSegDesc(selectedSegment.description || "");
                setSegColor(selectedSegment.color || "#6366f1");
                setSegConditions(selectedSegment.conditions ?? null);
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                setEmailOpen(true);
              }}
            >
              <Mail className="h-3.5 w-3.5" />
              Add by Email
            </Button>
            <input
              type="file"
              accept=".csv"
              ref={csvInputRef}
              onChange={handleCsvImport}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import CSV
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                setSelectedContactIds(new Set());
                setContactSearch("");
                loadAllContacts();
                setAddOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contacts
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Contacts table */}
        {loadingContacts ? (
          <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading contacts…</span>
          </div>
        ) : segmentContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Users className="h-9 w-9 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium">No contacts in this segment</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add contacts manually, by email, or import a CSV.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentContacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">
                        {c.first_name} {c.last_name}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.added_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveContact(c.id, `${c.first_name} ${c.last_name}`)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit segment dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Segment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={segName} onChange={(e) => setSegName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={segDesc} onChange={(e) => setSegDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={segColor}
                    onChange={(e) => setSegColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm text-muted-foreground">{segColor}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <ConditionBuilder conditions={segConditions} onChange={setSegConditions} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary">Cancel</Button>} />
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add contacts dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add Contacts to {selectedSegment.name}</DialogTitle>
              <DialogDescription>Select contacts from your workspace to add to this segment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts…"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {loadingAllContacts ? (
                <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  {filteredContacts.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No contacts found.</p>
                  ) : (
                    filteredContacts.map((c) => {
                      const isSelected = selectedContactIds.has(c.id);
                      const alreadyInSegment = segmentContacts.some((sc) => sc.id === c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (alreadyInSegment) return;
                            setSelectedContactIds((prev) => {
                              const next = new Set(prev);
                              if (isSelected) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            });
                          }}
                          disabled={alreadyInSegment}
                          className={cn(
                            "w-full text-left px-3 py-2 border-b border-border last:border-0 transition-colors",
                            alreadyInSegment
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                                ? "bg-primary/10"
                                : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.email}</p>
                            </div>
                            {alreadyInSegment ? (
                              <Badge variant="secondary" className="text-[10px]">In segment</Badge>
                            ) : isSelected ? (
                              <div className="h-4 w-4 rounded-full bg-primary" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border border-border" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
              {selectedContactIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedContactIds.size} contact(s) selected
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary">Cancel</Button>} />
              <Button onClick={handleAddContacts} disabled={saving || selectedContactIds.size === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${selectedContactIds.size} Contact(s)`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add by email dialog */}
        <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Contacts by Email</DialogTitle>
              <DialogDescription>
                Enter email addresses (one per line or comma-separated). Contacts that don't exist will be created automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder={"john@example.com\njane@example.com\nBob Smith <bob@company.com>"}
                className="w-full h-32 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary">Cancel</Button>} />
              <Button onClick={handleAddEmails} disabled={addingEmails || !emailText.trim()}>
                {addingEmails ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Contacts"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete segment dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Segment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{selectedSegment.name}</strong>? The contacts themselves will not be deleted, only the segment grouping.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary">Cancel</Button>} />
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Segment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Segment list view ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create segments to group contacts for targeted outreach.
        </p>
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => {
            setSegName("");
            setSegDesc("");
            setSegColor("#6366f1");
            setSegConditions(null);
            setCreateOpen(true);
          }}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New Segment
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading segments…</span>
        </div>
      ) : segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FolderPlus className="h-9 w-9 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">No segments yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a segment to group contacts together.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => (
            <button
              key={seg.id}
              onClick={() => openSegment(seg)}
              className="glass glass-hover glass-sheen relative overflow-hidden rounded-xl p-4 text-left"
            >
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color || "#6366f1" }}
                  />
                  <div>
                    <p className="text-sm font-semibold">{seg.name}</p>
                    {seg.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {seg.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="relative z-10 mt-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {seg.contact_count ?? 0} contact{(seg.contact_count ?? 0) !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create segment dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Segment</DialogTitle>
            <DialogDescription>Create a segment to group contacts together.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. VIP Customers"
                value={segName}
                onChange={(e) => setSegName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="What is this segment for?"
                value={segDesc}
                onChange={(e) => setSegDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={segColor}
                  onChange={(e) => setSegColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                />
                <span className="text-sm text-muted-foreground">{segColor}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <ConditionBuilder conditions={segConditions} onChange={setSegConditions} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="secondary">Cancel</Button>} />
            <Button onClick={handleCreate} disabled={saving || !segName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Segment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
