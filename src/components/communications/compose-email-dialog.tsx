"use client";

import { useState, useRef } from "react";
import { Loader2, Send, Mail, AlertCircle, ChevronDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sendContactEmail } from "@/app/actions/communications";
import { RichTextEditor } from "./rich-text-editor";
import { TEMPLATE_VARIABLES } from "@/lib/email/liquid";

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
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSubject(defaultSubject ?? "");
    setBodyHtml("");
    setError(null);
    setSending(false);
  }

  function insertSubjectVariable(token: string) {
    const input = subjectInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? subject.length;
    const end = input.selectionEnd ?? subject.length;
    const newValue = subject.slice(0, start) + token + subject.slice(end);
    setSubject(newValue);
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    });
  }

  async function handleSend() {
    setError(null);
    if (!subject.trim()) return setError("Please enter a subject.");
    const textContent = bodyHtml.replace(/<[^>]*>/g, "").trim();
    if (!textContent) return setError("Please write a message.");

    setSending(true);
    const { error: sendError } = await sendContactEmail({
      contactId: contact.id,
      subject,
      body: bodyHtml,
      bodyHtml: true,
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
      <DialogContent className="sm:max-w-2xl">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="email-subject" className="text-xs">Subject</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <span
                      className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      Insert Variable
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {TEMPLATE_VARIABLES.map((group) => (
                      <div key={group.group}>
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.group}
                        </p>
                        {group.items.map((item) => (
                          <DropdownMenuItem
                            key={item.token}
                            onClick={() => insertSubjectVariable(item.token)}
                            className="text-xs justify-between"
                          >
                            {item.label}
                            <code className="text-[10px] text-muted-foreground">{item.token}</code>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Input
                ref={subjectInputRef}
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line — use {{contact.first_name}} to personalize"
                disabled={sending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <RichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Write your email… Use Insert Variable to personalize."
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
