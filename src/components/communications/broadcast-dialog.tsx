"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Send, Users, PenLine, Eye, ChevronDown, AlertCircle, Check, ArrowRight, ArrowLeft } from "lucide-react";
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
import { sendBroadcastEmail } from "@/app/actions/communications";
import { RichTextEditor } from "./rich-text-editor";
import { RecipientSelector, type RecipientContact } from "./recipient-selector";
import { EmailPreview } from "./email-preview";
import { TEMPLATE_VARIABLES, type TemplateContext } from "@/lib/email/liquid";
import { cn } from "@/lib/utils";

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: RecipientContact[];
  contactsLoading?: boolean;
  workspaceName?: string;
  fromName?: string;
  fromEmail?: string;
  signatureHtml?: string;
  onSent?: () => void;
}

type Step = "recipients" | "compose" | "preview" | "sending" | "result";

export function BroadcastDialog({
  open,
  onOpenChange,
  contacts,
  contactsLoading,
  workspaceName = "Your Workspace",
  fromName,
  fromEmail,
  signatureHtml = "",
  onSent,
}: BroadcastDialogProps) {
  const [step, setStep] = useState<Step>("recipients");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("recipients");
    setSelectedIds([]);
    setSubject("");
    setBodyHtml("");
    setError(null);
    setResult(null);
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

  // Build sample contact contexts for preview
  const sampleContacts = contacts
    .filter((c) => selectedIds.includes(c.id))
    .slice(0, 5)
    .map((c) => {
      const ctx: TemplateContext = {
        contact: {
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: null,
          company: c.company,
          status: c.status,
          custom_fields: {},
        },
        workspace: { name: workspaceName },
      };
      return { id: c.id, name: `${c.first_name} ${c.last_name}`, email: c.email, ctx };
    });

  function handleNext() {
    setError(null);
    if (step === "recipients") {
      if (selectedIds.length === 0) return setError("Select at least one recipient.");
      setStep("compose");
    } else if (step === "compose") {
      if (!subject.trim()) return setError("Please enter a subject.");
      const textContent = bodyHtml.replace(/<[^>]*>/g, "").trim();
      if (!textContent) return setError("Please write a message.");
      setStep("preview");
    }
  }

  function handleBack() {
    setError(null);
    if (step === "compose") setStep("recipients");
    else if (step === "preview") setStep("compose");
  }

  async function handleSend() {
    setError(null);
    setStep("sending");
    const { sentCount, failedCount, error: sendError } = await sendBroadcastEmail({
      subject,
      bodyHtml,
      contactIds: selectedIds,
    });
    if (sendError) {
      setError(sendError);
      setStep("preview");
      return;
    }
    setResult({ sentCount, failedCount });
    setStep("result");
    onSent?.();
  }

  const steps: { key: Step; label: string; icon: typeof Users }[] = [
    { key: "recipients", label: "Recipients", icon: Users },
    { key: "compose", label: "Compose", icon: PenLine },
    { key: "preview", label: "Preview", icon: Eye },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-400" />
            New Broadcast
          </DialogTitle>
          <DialogDescription>
            Send a personalized email to multiple contacts at once.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {step !== "sending" && step !== "result" && (
          <div className="flex items-center gap-2 py-2">
            {steps.map((s, i) => {
              const stepIndex = steps.findIndex((x) => x.key === step);
              const isActive = s.key === step;
              const isComplete = i < stepIndex;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      isActive && "bg-indigo-500/10 text-indigo-300",
                      isComplete && "text-emerald-400",
                      !isActive && !isComplete && "text-muted-foreground"
                    )}
                  >
                    <s.icon className="h-3.5 w-3.5" />
                    {s.label}
                    {isComplete && <Check className="h-3 w-3" />}
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        {/* Step content */}
        {step === "recipients" && (
          <RecipientSelector
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            contacts={contacts}
            loading={contactsLoading}
          />
        )}

        {step === "compose" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Subject</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <button
                      type="button"
                      className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      Insert Variable
                      <ChevronDown className="h-3 w-3" />
                    </button>
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
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line — use {{contact.first_name}} to personalize"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <RichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Write your broadcast email… Use Insert Variable to personalize for each recipient."
              />
            </div>
          </div>
        )}

        {step === "preview" && (
          <EmailPreview
            subject={subject}
            bodyHtml={bodyHtml}
            fromName={fromName ?? workspaceName}
            fromEmail={fromEmail}
            signatureHtml={signatureHtml}
            sampleContacts={sampleContacts}
          />
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-sm font-medium">Sending broadcast…</p>
            <p className="text-xs text-muted-foreground">
              Sending to {selectedIds.length} recipient{selectedIds.length !== 1 ? "s" : ""}. This may take a moment.
            </p>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Broadcast sent!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.sentCount} sent{result.failedCount > 0 ? `, ${result.failedCount} failed` : ""}
              </p>
            </div>
            {result.failedCount > 0 && (
              <p className="text-xs text-amber-400">
                Some emails failed to send. Check the broadcast history for details.
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        {step !== "sending" && step !== "result" && (
          <DialogFooter>
            {step !== "recipients" && (
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {step !== "preview" ? (
              <Button onClick={handleNext} className="gap-2">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSend} className="gap-2">
                <Send className="h-4 w-4" />
                Send to {selectedIds.length} recipient{selectedIds.length !== 1 ? "s" : ""}
              </Button>
            )}
          </DialogFooter>
        )}

        {step === "result" && (
          <DialogFooter>
            <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
