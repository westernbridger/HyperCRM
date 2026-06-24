"use client";

import { useState, useCallback } from "react";
import { Radio, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getBroadcastRecipients,
  type BroadcastListItem,
  type BroadcastRecipientItem,
} from "@/app/actions/communications";

interface BroadcastListProps {
  broadcasts: BroadcastListItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function BroadcastList({ broadcasts, loading, onRefresh }: BroadcastListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<BroadcastRecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingRecipients(true);
    const { data } = await getBroadcastRecipients(id);
    setRecipients(data ?? []);
    setLoadingRecipients(false);
  }, [expandedId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-border bg-card">
        <Radio className="h-9 w-9 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-medium">No broadcasts yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click "New Broadcast" to send an email to multiple contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Broadcast History</h3>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {broadcasts.map((b) => (
          <div key={b.id}>
            <button
              onClick={() => toggleExpand(b.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
            >
              {expandedId === b.id ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{b.subject || "(no subject)"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(b.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {b.recipient_count} recipient{b.recipient_count !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {b.sent_count}
                  </span>
                  {b.failed_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {b.failed_count}
                    </span>
                  )}
                </div>
                <StatusPill status={b.status} />
              </div>
            </button>

            {expandedId === b.id && (
              <div className="bg-muted/30 px-4 py-3 border-t border-border">
                {loadingRecipients ? (
                  <div className="flex items-center justify-center h-20 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Loading recipients…</span>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {recipients.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-secondary/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{r.contact_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.contact_email}</p>
                        </div>
                        {r.status === "sent" ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Sent
                          </span>
                        ) : r.status === "failed" ? (
                          <span className="flex items-center gap-1 text-xs text-red-400" title={r.error ?? ""}>
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    sending: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    partial_failure: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    draft: "bg-muted text-muted-foreground border-border",
  };
  const labels: Record<string, string> = {
    sent: "Sent",
    sending: "Sending",
    partial_failure: "Partial",
    draft: "Draft",
  };
  return (
    <span className={cn(
      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
      styles[status] ?? styles.draft
    )}>
      {labels[status] ?? status}
    </span>
  );
}
