"use client";

import { useState } from "react";
import { Loader2, Send, Mail, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendContactEmail } from "@/app/actions/communications";

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: { id: string; name: string; email: string };
  conversationId?: string;
  defaultSubject?: string;
  onSent?: () => void;
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  contact,
  conversationId,
  defaultSubject,
  onSent,
}: ComposeEmailDialogProps) {
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSubject(defaultSubject ?? "");
    setBody("");
    setError(null);
    setSending(false);
  }

  async function handleSend() {
    setError(null);
    if (!subject.trim()) return setError("Please enter a subject.");
    if (!body.trim()) return setError("Please write a message.");

    setSending(true);
    const { error: sendError } = await sendContactEmail({
      contactId: contact.id,
      subject,
      body,
      conversationId,
    });
    setSending(false);

    if (sendError) {
      setError(sendError);
      return;
    }
    onSent?.();
    onOpenChange(false);
    reset();
  }

  const noEmail = !contact.email;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-400" />
            New Email
          </DialogTitle>
          <DialogDescription>
            To <span className="font-medium text-foreground">{contact.name}</span>{" "}
            {contact.email ? `<${contact.email}>` : ""}
          </DialogDescription>
        </DialogHeader>

        {noEmail ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            This contact has no email address on file.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                disabled={sending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-body" className="text-xs">Message</Label>
              <Textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message…"
                rows={9}
                className="resize-none"
                disabled={sending}
              />
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || noEmail} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
