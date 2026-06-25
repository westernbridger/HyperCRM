"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, X, Check, Users, Loader2, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSegments, getSegmentContactIds, type Segment } from "@/app/actions/segments";

export type RecipientContact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  status: string;
};

interface RecipientSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  contacts: RecipientContact[];
  loading?: boolean;
}

export function RecipientSelector({
  selectedIds,
  onSelectionChange,
  contacts,
  loading,
}: RecipientSelectorProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [addingSegment, setAddingSegment] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setSegmentsLoading(true);
      const { data } = await getSegments();
      setSegments(data ?? []);
      setSegmentsLoading(false);
    })();
  }, []);

  const handleAddSegment = useCallback(async (segmentId: string) => {
    setAddingSegment(segmentId);
    const { data: ids } = await getSegmentContactIds(segmentId);
    if (ids && ids.length > 0) {
      const newSet = new Set([...selectedIds, ...ids]);
      onSelectionChange(Array.from(newSet));
    }
    setAddingSegment(null);
  }, [selectedIds, onSelectionChange]);

  const filtered = useMemo(() => {
    let list = contacts.filter((c) => c.email);
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [contacts, search, statusFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedSet.has(c.id)),
    [contacts, selectedSet]
  );

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  function selectAllVisible() {
    const visibleIds = filtered.map((c) => c.id);
    const newSet = new Set([...selectedIds, ...visibleIds]);
    onSelectionChange(Array.from(newSet));
  }

  function clearAll() {
    onSelectionChange([]);
  }

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-muted/30">
          {selectedContacts.slice(0, 20).map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300"
            >
              {c.first_name} {c.last_name}
              <button
                onClick={() => toggle(c.id)}
                className="hover:text-indigo-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedContacts.length > 20 && (
            <span className="text-xs text-muted-foreground px-1 py-0.5">
              +{selectedContacts.length - 20} more
            </span>
          )}
          <button
            onClick={clearAll}
            className="ml-auto text-xs text-red-400 hover:text-red-300"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Segments quick-add */}
      {segments.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <FolderPlus className="h-3.5 w-3.5" />
            Segments:
          </span>
          {segmentsLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => handleAddSegment(seg.id)}
                disabled={addingSegment === seg.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                {addingSegment === seg.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: seg.color || "#6366f1" }}
                  />
                )}
                {seg.name}
                <span className="text-muted-foreground">({seg.contact_count ?? 0})</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company…"
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="Lead">Lead</option>
          <option value="Prospect">Prospect</option>
          <option value="Customer">Customer</option>
          <option value="Churned">Churned</option>
        </select>
      </div>

      {/* Select all bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""} with email
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllVisible}>
            Select all visible
          </Button>
        </div>
      )}

      {/* Contact list */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Users className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-xs">No contacts found</p>
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/50",
                selectedSet.has(c.id) && "bg-indigo-500/5"
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  selectedSet.has(c.id)
                    ? "bg-indigo-500 border-indigo-500"
                    : "border-border"
                )}
              >
                {selectedSet.has(c.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
              </div>
              {c.company && (
                <span className="text-xs text-muted-foreground shrink-0">{c.company}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{selectedIds.length}</span> recipient{selectedIds.length !== 1 ? "s" : ""} selected
        </span>
      </div>
    </div>
  );
}
