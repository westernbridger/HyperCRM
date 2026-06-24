"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getEmailDomains,
  addEmailDomain,
  verifyEmailDomain,
  refreshEmailDomain,
  removeEmailDomain,
  setDefaultEmailDomain,
  getActiveSender,
  type EmailDomain,
  type DnsRecord,
  type ActiveSender,
} from "@/app/actions/email-domains";
import { cn } from "@/lib/utils";

export function EmailDomainsPanel() {
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [activeSender, setActiveSender] = useState<ActiveSender | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [domainsRes, senderRes] = await Promise.all([
      getEmailDomains(),
      getActiveSender(),
    ]);
    setDomains(domainsRes.data ?? []);
    setActiveSender(senderRes.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVerify(id: string) {
    setBusyId(id);
    const { data } = await verifyEmailDomain(id);
    if (data) setDomains((d) => d.map((x) => (x.id === id ? data : x)));
    setBusyId(null);
  }

  async function handleRefresh(id: string) {
    setBusyId(id);
    const { data } = await refreshEmailDomain(id);
    if (data) setDomains((d) => d.map((x) => (x.id === id ? data : x)));
    setBusyId(null);
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    const { error } = await removeEmailDomain(id);
    if (!error) setDomains((d) => d.filter((x) => x.id !== id));
    setBusyId(null);
  }

  async function handleSetDefault(id: string) {
    setBusyId(id);
    await setDefaultEmailDomain(id);
    await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <ActiveSenderBanner sender={activeSender} loading={loading} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Sending Domains</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send emails from your own domain. Add a domain, configure the DNS records,
            then verify it to start sending.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Domain
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <Globe className="h-9 w-9 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">No sending domains yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Until you add one, emails are sent from the shared HyperCRM address.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <DomainCard
              key={d.id}
              domain={d}
              busy={busyId === d.id}
              onVerify={() => handleVerify(d.id)}
              onRefresh={() => handleRefresh(d.id)}
              onRemove={() => handleRemove(d.id)}
              onSetDefault={() => handleSetDefault(d.id)}
            />
          ))}
        </div>
      )}

      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(d) => setDomains((prev) => [d, ...prev])}
      />
    </div>
  );
}

function ActiveSenderBanner({ sender, loading }: { sender: ActiveSender | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading sender info…</span>
      </div>
    );
  }

  if (!sender) return null;

  return (
    <div className={cn(
      "rounded-xl border p-4 flex items-start gap-3",
      sender.isCustom
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-indigo-500/20 bg-indigo-500/5"
    )}>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        sender.isCustom ? "bg-emerald-500/10" : "bg-indigo-500/10"
      )}>
        {sender.isCustom ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <Globe className="h-5 w-5 text-indigo-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Active Sender</p>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            sender.isCustom
              ? "text-emerald-400 bg-emerald-500/10"
              : "text-indigo-400 bg-indigo-500/10"
          )}>
            {sender.isCustom ? "Custom Domain" : "Default"}
          </span>
        </div>
        <p className="text-sm text-foreground/80 mt-1">
          <span className="font-medium">{sender.fromAddress}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span>Domain: <span className="font-mono">{sender.domain}</span></span>
          {sender.inboundEmail && (
            <span>Reply-to: <span className="font-mono">{sender.inboundEmail}</span></span>
          )}
        </div>
        {!sender.isCustom && (
          <p className="text-xs text-muted-foreground mt-2">
            Add and verify your own domain below to send from a custom address.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: EmailDomain["status"] }) {
  const map = {
    verified: { icon: CheckCircle2, label: "Verified", cls: "text-emerald-400 bg-emerald-500/10" },
    pending: { icon: Clock, label: "Pending", cls: "text-amber-400 bg-amber-500/10" },
    failed: { icon: AlertCircle, label: "Failed", cls: "text-red-400 bg-red-500/10" },
    temporary_failure: { icon: AlertCircle, label: "Retrying", cls: "text-amber-400 bg-amber-500/10" },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", map.cls)}>
      <Icon className="h-3 w-3" />
      {map.label}
    </span>
  );
}

function DomainCard({
  domain,
  busy,
  onVerify,
  onRefresh,
  onRemove,
  onSetDefault,
}: {
  domain: EmailDomain;
  busy: boolean;
  onVerify: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onSetDefault: () => void;
}) {
  const [expanded, setExpanded] = useState(domain.status !== "verified");
  const verified = domain.status === "verified";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{domain.domain}</span>
            <StatusPill status={domain.status} />
            {domain.is_default && verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                <Star className="h-3 w-3" />
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {domain.from_name ? `${domain.from_name} <${domain.from_email}>` : domain.from_email}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {verified && !domain.is_default && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onSetDefault} disabled={busy}>
              <Star className="h-3.5 w-3.5" />
              Make default
            </Button>
          )}
          {!verified && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onVerify} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Verify
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={busy} title="Refresh status">
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} disabled={busy} title="Remove domain" className="text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* DNS records */}
      {domain.dns_records.length > 0 && (
        <div className="border-t border-border">
          <button
            className="w-full px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-secondary/40"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Hide" : "Show"} DNS records ({domain.dns_records.length})
          </button>
          {expanded && (
            <div className="px-4 pb-4 space-y-2">
              {!verified && (
                <p className="text-xs text-muted-foreground">
                  Add these records at your DNS provider, then click <span className="font-medium">Verify</span>.
                  Propagation can take a few minutes to a few hours.
                </p>
              )}
              <div className="space-y-2">
                {(domain.dns_records as DnsRecord[]).map((r, i) => (
                  <DnsRecordRow key={i} record={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DnsRecordRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">{record.type}</span>
        {record.priority != null && (
          <span className="text-muted-foreground">priority {record.priority}</span>
        )}
        {record.status && (
          <span className={cn("ml-auto text-[10px]", record.status === "verified" ? "text-emerald-400" : "text-amber-400")}>
            {record.status}
          </span>
        )}
      </div>
      <Field label="Name / Host" value={record.name} copied={copied === "name"} onCopy={() => copy(record.name, "name")} />
      <Field label="Value" value={record.value} copied={copied === "value"} onCopy={() => copy(record.value, "value")} />
    </div>
  );
}

function Field({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <code className="flex-1 truncate font-mono text-foreground/80">{value}</code>
      <button onClick={onCopy} className="shrink-0 text-muted-foreground hover:text-foreground">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function AddDomainDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: (d: EmailDomain) => void;
}) {
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [localPart, setLocalPart] = useState("hello");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDomain("");
    setFromName("");
    setLocalPart("hello");
    setError(null);
    setSubmitting(false);
  }

  async function submit() {
    setError(null);
    const cleanDomain = domain.trim().toLowerCase();
    if (!cleanDomain) return setError("Enter your domain.");

    setSubmitting(true);
    const { data, error: addError } = await addEmailDomain({
      domain: cleanDomain,
      fromName: fromName.trim() || undefined,
      fromEmail: `${localPart.trim() || "hello"}@${cleanDomain}`,
    });
    setSubmitting(false);

    if (addError) return setError(addError);
    if (data) {
      onAdded(data);
      onOpenChange(false);
      reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sending Domain</DialogTitle>
          <DialogDescription>
            Register a domain you own. You&apos;ll get DNS records to add, then verify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="domain" className="text-xs">Domain</Label>
            <Input id="domain" placeholder="acme.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from-name" className="text-xs">From name (optional)</Label>
            <Input id="from-name" placeholder="Acme Sales" value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="local" className="text-xs">From address</Label>
            <div className="flex items-center gap-1">
              <Input id="local" value={localPart} onChange={(e) => setLocalPart(e.target.value)} disabled={submitting} className="w-28" />
              <span className="text-sm text-muted-foreground">@{domain.trim().toLowerCase() || "yourdomain.com"}</span>
            </div>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Domain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
