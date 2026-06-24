"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  Loader2,
  Inbox,
  ArrowLeft,
  CheckCheck,
  AlertCircle,
  Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { ComposeEmailDialog } from "./compose-email-dialog";
import {
  getConversations,
  getConversationMessages,
  getCommunicationStats,
  type ConversationListItem,
  type Message,
} from "@/app/actions/communications";
import { cn } from "@/lib/utils";

type Stats = {
  emailsSent: number;
  delivered: number;
  opened: number;
  openRate: number;
};

export function CommunicationsInbox() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [stats, setStats] = useState<Stats>({ emailsSent: 0, delivered: 0, opened: 0, openRate: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data }, s] = await Promise.all([getConversations(), getCommunicationStats()]);
    setConversations(data ?? []);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openConversation = useCallback(async (c: ConversationListItem) => {
    setSelected(c);
    setLoadingThread(true);
    const { data } = await getConversationMessages(c.id);
    setMessages(data ?? []);
    setLoadingThread(false);
  }, []);

  function handleSent() {
    loadAll();
    if (selected) openConversation(selected);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-sm text-muted-foreground">
            Email conversations with your contacts, in one place.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            if (selected) setComposeOpen(true);
          }}
          disabled={!selected}
          title={selected ? "Reply to this conversation" : "Select a conversation to reply"}
        >
          <Reply className="h-4 w-4" />
          Reply
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile title="Emails Sent" value={stats.emailsSent.toLocaleString()} change="All time" icon={Mail} />
        <MetricTile title="Delivered" value={stats.delivered.toLocaleString()} change="All time" icon={CheckCheck} />
        <MetricTile title="Opened" value={stats.opened.toLocaleString()} change="All time" icon={Inbox} />
        <MetricTile title="Open Rate" value={`${stats.openRate}%`} change="Of delivered" icon={Send} />
      </div>

      {/* Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 rounded-xl border border-border bg-card overflow-hidden min-h-[28rem]">
        {/* Conversation list */}
        <div className={cn("border-r border-border", selected && "hidden lg:block")}>
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Conversations</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
              <Inbox className="h-9 w-9 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium">No conversations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Email a contact from their profile to start a thread.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[34rem] overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors hover:bg-secondary/50",
                    selected?.id === c.id && "bg-secondary"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{c.contact_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelative(c.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/70 truncate mt-0.5">
                    {c.subject || "(no subject)"}
                  </p>
                  {c.last_message_preview && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.last_direction === "outbound" ? "You: " : ""}
                      {c.last_message_preview}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread view */}
        <div className={cn("flex flex-col", !selected && "hidden lg:flex")}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <p className="text-sm">Select a conversation to view messages.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <button
                  className="lg:hidden text-muted-foreground"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selected.contact_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.contact_email}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[30rem]">
                {loadingThread ? (
                  <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
              </div>

              <div className="border-t border-border p-3">
                <Button className="w-full gap-2" onClick={() => setComposeOpen(true)}>
                  <Reply className="h-4 w-4" />
                  Reply
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compose / reply dialog */}
      {selected && (
        <ComposeEmailDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          contact={{
            id: selected.contact_id,
            name: selected.contact_name,
            email: selected.contact_email,
          }}
          conversationId={selected.id}
          defaultSubject={selected.subject ? `Re: ${selected.subject.replace(/^Re:\s*/i, "")}` : ""}
          onSent={handleSent}
        />
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3.5 py-2.5",
          outbound ? "bg-indigo-500/15 border border-indigo-500/20" : "bg-secondary"
        )}
      >
        {message.subject && (
          <p className="text-xs font-semibold mb-1">{message.subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body_text}</p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{formatRelative(message.created_at)}</span>
          {outbound && <StatusBadge status={message.status} error={message.error} />}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-red-400" title={error ?? "Failed"}>
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  const label =
    status === "sent" ? "Sent" :
    status === "delivered" ? "Delivered" :
    status === "opened" ? "Opened" :
    status === "clicked" ? "Clicked" :
    status === "queued" ? "Queued" : status;
  return (
    <span className="flex items-center gap-1">
      <CheckCheck className="h-3 w-3" />
      {label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}
