"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail,
  Send,
  Loader2,
  Inbox,
  ArrowLeft,
  CheckCheck,
  AlertCircle,
  Reply,
  Radio,
  Paperclip,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ComposeEmailDialog } from "./compose-email-dialog";
import { BroadcastDialog } from "./broadcast-dialog";
import { BroadcastList } from "./broadcast-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getConversations,
  getConversationMessages,
  getCommunicationStats,
  getBroadcasts,
  deleteConversation,
  type ConversationListItem,
  type Message,
  type BroadcastListItem,
} from "@/app/actions/communications";
import { getContacts } from "@/app/actions/contacts";
import { getEmailSignature } from "@/app/actions/email-signature";
import { renderSignatureHtml } from "@/lib/email/signature";
import { cn } from "@/lib/utils";

type ContactForBroadcast = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  status: string;
};

type Stats = {
  emailsSent: number;
  delivered: number;
  opened: number;
  openRate: number;
  inboundCount: number;
  activeConversations: number;
};

export function CommunicationsInbox() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [stats, setStats] = useState<Stats>({ emailsSent: 0, delivered: 0, opened: 0, openRate: 0, inboundCount: 0, activeConversations: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastListItem[]>([]);
  const [contacts, setContacts] = useState<ContactForBroadcast[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [signatureHtml, setSignatureHtml] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data }, s, { data: broadcastData }] = await Promise.all([
      getConversations(),
      getCommunicationStats(),
      getBroadcasts(),
    ]);
    setConversations(data ?? []);
    setStats(s);
    setBroadcasts(broadcastData ?? []);
    setLoading(false);
  }, []);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    const { data } = await getContacts();
    if (data) {
      setContacts(
        data.map((c) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          company: c.company,
          status: c.status,
        }))
      );
    }
    setContactsLoading(false);
  }, []);

  const loadSignature = useCallback(async () => {
    const { data } = await getEmailSignature();
    if (data) setSignatureHtml(renderSignatureHtml(data));
  }, []);

  useEffect(() => {
    loadAll();
    loadContacts();
    loadSignature();
  }, [loadAll, loadContacts, loadSignature]);

  const openConversation = useCallback(async (c: ConversationListItem) => {
    setSelected(c);
    setLoadingThread(true);
    const { data } = await getConversationMessages(c.id);
    setMessages(data ?? []);
    setLoadingThread(false);
    // Scroll to bottom after messages load
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  function handleSent() {
    loadAll();
    if (selected) openConversation(selected);
  }

  async function handleDeleteConversation() {
    if (!selected) return;
    setDeleting(true);
    const { error } = await deleteConversation(selected.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
    if (error) return;
    setSelected(null);
    setMessages([]);
    loadAll();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-sm text-muted-foreground">
            Email conversations and broadcasts with your contacts.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => setBroadcastOpen(true)}
        >
          <Radio className="h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <GlassMetric icon={Mail} label="Sent" value={stats.emailsSent} />
        <GlassMetric icon={Inbox} label="Inbound" value={stats.inboundCount} />
        <GlassMetric icon={CheckCheck} label="Delivered" value={stats.delivered} />
        <GlassMetric icon={Send} label="Opened" value={stats.opened} />
        <GlassMetric icon={Reply} label="Open Rate" value={`${stats.openRate}%`} />
        <GlassMetric icon={AlertCircle} label="Active" value={stats.activeConversations} />
      </div>

      <Tabs defaultValue="inbox">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="gap-2">
            <Radio className="h-4 w-4" />
            Broadcasts
            {broadcasts.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-500/20 px-1.5 text-[10px] font-medium text-indigo-300">
                {broadcasts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
      {/* Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 rounded-xl glass overflow-hidden min-h-[28rem]">
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
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{selected.contact_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.contact_email}</p>
                </div>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleting}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  title="Delete conversation"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[30rem]">
                {loadingThread ? (
                  <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
                <div ref={messagesEndRef} />
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This will permanently delete the conversation and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteConversation}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="broadcasts" className="mt-4">
          <BroadcastList
            broadcasts={broadcasts}
            loading={loading}
            onRefresh={loadAll}
          />
        </TabsContent>
      </Tabs>

      {/* Broadcast dialog */}
      <BroadcastDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        contacts={contacts}
        contactsLoading={contactsLoading}
        signatureHtml={signatureHtml}
        onSent={loadAll}
      />
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
        {message.body_html ? (
          <div
            className="text-sm break-words [&_p]:my-1"
            dangerouslySetInnerHTML={{ __html: message.body_html }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.body_text}</p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.attachments.map((a, i) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-background/50 border border-border px-2.5 py-1 text-xs hover:bg-background/80 transition-colors"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[140px] truncate">{a.filename}</span>
                {a.size > 0 && <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>}
              </a>
            ))}
          </div>
        )}
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

function GlassMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="glass glass-hover glass-sheen relative overflow-hidden rounded-xl p-3">
      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-1">{label}</p>
          <p className="text-base font-bold tracking-tight leading-none truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
