"use client";

import { useState, useRef } from "react";
import { Loader2, Send, Mail, AlertCircle, ChevronDown, Paperclip, X, FileText } from "lucide-react";
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
import { sendContactEmail, uploadEmailAttachment } from "@/app/actions/communications";
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
  const [attachments, setAttachments] = useState<{ filename: string; url: string; content_type: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSubject(defaultSubject ?? "");
    setBodyHtml("");
    setError(null);
    setSending(false);
    setAttachments([]);
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
      attachments: attachments.length > 0 ? attachments : undefined,
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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Message</Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                >
                  <Paperclip className="h-3 w-3" />
                  Attach file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    setUploading(true);
                    for (const file of files) {
                      const { url, filename, contentType, size, error: upErr } = await uploadEmailAttachment(file);
                      if (upErr || !url || !filename) {
                        setError(upErr ?? "Upload failed");
                      } else {
                        setAttachments((prev) => [...prev, { filename, url, content_type: contentType ?? "application/octet-stream", size: size ?? 0 }]);
                      }
                    }
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
              </div>
              <RichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Write your email… Use Insert Variable to personalize."
              />
              {uploading && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Uploading…
                </p>
              )}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2.5 py-1 text-xs">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[160px] truncate">{a.filename}</span>
                      <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
