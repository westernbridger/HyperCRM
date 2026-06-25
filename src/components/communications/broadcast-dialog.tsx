"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, Send, Users, PenLine, Eye, ChevronDown, AlertCircle, Check, ArrowRight, ArrowLeft, AlertTriangle, Wand2 } from "lucide-react";
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
import { TEMPLATE_VARIABLES, type TemplateContext, extractVariables, resolvePath } from "@/lib/email/liquid";
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

type Step = "recipients" | "compose" | "preview" | "validation" | "fallbacks" | "sending" | "result";

type InvalidContact = {
  id: string;
  name: string;
  email: string;
  reasons: string[];
};

// Transform {{var}} into {{var | default: "value"}} for variables that have fallbacks set.
// Skips variables that already use a pipe filter.
function applyFallbacks(template: string, fallbacks: Record<string, string>): string {
  let result = template;
  for (const [varPath, fallbackValue] of Object.entries(fallbacks)) {
    if (!fallbackValue.trim()) continue;
    const escapedPath = varPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match {{var}} or {{ var }} but NOT {{var | ...}}
    const regex = new RegExp(`\\{\\{\\s*${escapedPath}\\s*(?!\\|)\\}\\}`, "g");
    const safeValue = fallbackValue.replace(/"/g, '\\"');
    result = result.replace(regex, `{{${varPath} | default: "${safeValue}"}}`);
  }
  return result;
}

// Human-friendly label for a variable path like "contact.first_name" → "First Name"
function varLabel(path: string): string {
  for (const group of TEMPLATE_VARIABLES) {
    const item = group.items.find((i) => i.token === `{{${path}}}`);
    if (item) return item.label;
  }
  // Fallback: prettify the path
  const parts = path.split(".");
  const last = parts[parts.length - 1];
  return last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const [invalidContacts, setInvalidContacts] = useState<InvalidContact[]>([]);
  const [validContactIds, setValidContactIds] = useState<string[]>([]);
  const [fallbacks, setFallbacks] = useState<Record<string, string>>({});
  const subjectInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("recipients");
    setSelectedIds([]);
    setSubject("");
    setBodyHtml("");
    setError(null);
    setResult(null);
    setInvalidContacts([]);
    setValidContactIds([]);
    setFallbacks({});
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


  function validateRecipients(fallbacksMap: Record<string, string>): { invalid: InvalidContact[]; validIds: string[] } {
    const templateVars = extractVariables(subject + " " + bodyHtml);
    const invalid: InvalidContact[] = [];
    const validIds: string[] = [];

    for (const c of contacts) {
      if (!selectedIds.includes(c.id)) continue;
      const reasons: string[] = [];

      // Check email
      if (!c.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
        reasons.push("Missing or invalid email");
      }

      // Check liquid template variables (skip those with fallbacks set)
      if (reasons.length === 0 && templateVars.length > 0) {
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
        for (const varPath of templateVars) {
          // Skip validation if a fallback is set for this variable
          if (fallbacksMap[varPath]?.trim()) continue;
          const value = resolvePath(varPath, ctx);
          if (value === null || value === undefined || value === "") {
            reasons.push(`Missing {{${varPath}}}`);
          }
        }
      }

      if (reasons.length > 0) {
        invalid.push({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`.trim() || c.email || c.id,
          email: c.email || "(no email)",
          reasons,
        });
      } else {
        validIds.push(c.id);
      }
    }

    return { invalid, validIds };
  }

  function handleSend() {
    setError(null);
    const { invalid, validIds } = validateRecipients(fallbacks);
    setInvalidContacts(invalid);
    setValidContactIds(validIds);

    if (invalid.length > 0) {
      setStep("validation");
      return;
    }

    doSend(selectedIds);
  }

  function revalidate() {
    const { invalid, validIds } = validateRecipients(fallbacks);
    setInvalidContacts(invalid);
    setValidContactIds(validIds);
    if (invalid.length > 0) {
      setStep("validation");
    } else {
      doSend(selectedIds);
    }
  }

  async function doSend(ids: string[]) {
    setError(null);
    setStep("sending");
    const finalSubject = applyFallbacks(subject, fallbacks);
    const finalBody = applyFallbacks(bodyHtml, fallbacks);
    const { sentCount, failedCount, error: sendError } = await sendBroadcastEmail({
      subject: finalSubject,
      bodyHtml: finalBody,
      contactIds: ids,
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

  function handleBack() {
    setError(null);
    if (step === "compose") setStep("recipients");
    else if (step === "preview") setStep("compose");
    else if (step === "validation") setStep("preview");
    else if (step === "fallbacks") setStep("validation");
  }

  // Unique template variables used in subject + body
  const templateVars = Array.from(new Set(extractVariables(subject + " " + bodyHtml)));

  // Count how many selected contacts are missing each variable
  const missingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const varPath of templateVars) {
      if (fallbacks[varPath]?.trim()) { counts[varPath] = 0; continue; }
      let n = 0;
      for (const c of contacts) {
        if (!selectedIds.includes(c.id)) continue;
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
        const value = resolvePath(varPath, ctx);
        if (value === null || value === undefined || value === "") n++;
      }
      counts[varPath] = n;
    }
    return counts;
  }, [templateVars, contacts, selectedIds, fallbacks, workspaceName]);

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
        {step !== "sending" && step !== "result" && step !== "validation" && step !== "fallbacks" && (
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

        {step === "validation" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-amber-300">
                  {invalidContacts.length} contact{invalidContacts.length !== 1 ? "s" : ""} will be skipped
                </p>
                <p className="text-xs text-amber-200/70">
                  These contacts have missing or invalid email addresses, or are missing data for template variables used in your message. They will not receive this broadcast to protect your deliverability.
                </p>
                {templateVars.some((v) => missingCounts[v] > 0) && (
                  <button
                    onClick={() => setStep("fallbacks")}
                    className="inline-flex items-center gap-1.5 mt-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/25 transition-colors"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Add fallback values for missing variables
                  </button>
                )}
              </div>
            </div>

            {validContactIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{validContactIds.length}</span> contact{validContactIds.length !== 1 ? "s" : ""} will receive the broadcast.
              </p>
            )}

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {invalidContacts.map((c) => (
                <div key={c.id} className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "fallbacks" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Wand2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-300">Set fallback values</p>
                <p className="text-xs text-indigo-200/70">
                  When a contact is missing a value for a template variable, the fallback will be used instead. This allows the message to go through with a sensible default.
                </p>
              </div>
            </div>

            {templateVars.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No template variables found in your message.
              </p>
            ) : (
              <div className="space-y-3">
                {templateVars.map((varPath) => {
                  const missing = missingCounts[varPath] ?? 0;
                  const hasFallback = !!fallbacks[varPath]?.trim();
                  return (
                    <div key={varPath} className="flex items-center gap-3">
                      <div className="w-48 shrink-0">
                        <p className="text-sm font-medium">{varLabel(varPath)}</p>
                        <code className="text-[10px] text-muted-foreground">{"{{"}{varPath}{"}}"}</code>
                      </div>
                      <Input
                        value={fallbacks[varPath] ?? ""}
                        onChange={(e) => setFallbacks((prev) => ({ ...prev, [varPath]: e.target.value }))}
                        placeholder={hasFallback ? "" : "Default value…"}
                        className="flex-1"
                      />
                      <div className="w-32 shrink-0 text-right">
                        {missing > 0 && !hasFallback ? (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                            {missing} missing
                          </span>
                        ) : hasFallback ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            <Check className="h-3 w-3 mr-0.5" />Fallback set
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">All set</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
        {step !== "sending" && step !== "result" && step !== "validation" && step !== "fallbacks" && (
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

        {step === "validation" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {templateVars.some((v) => missingCounts[v] > 0) && (
              <Button variant="outline" onClick={() => setStep("fallbacks")} className="gap-2">
                <Wand2 className="h-4 w-4" />
                Add Fallbacks
              </Button>
            )}
            {validContactIds.length > 0 ? (
              <Button onClick={() => doSend(validContactIds)} className="gap-2">
                <Send className="h-4 w-4" />
                Send to {validContactIds.length} valid recipient{validContactIds.length !== 1 ? "s" : ""}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground self-center">No valid recipients to send to.</p>
            )}
          </DialogFooter>
        )}

        {step === "fallbacks" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={revalidate} className="gap-2">
              <Check className="h-4 w-4" />
              Apply & Re-validate
            </Button>
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
