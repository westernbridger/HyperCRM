"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FileText,
  ListChecks,
  Loader2,
  Search,
  ToggleRight,
  ToggleLeft,
  Lock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormDetail } from "@/components/documents/form-detail";
import { FormBuilder } from "@/components/documents/form-builder";
import { getForms, createForm, type HyperForm } from "@/app/actions/forms";
import {
  getChecklists,
  createChecklist,
  type Checklist,
} from "@/app/actions/checklists";
import type { HyperFormField } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type DocTab = "forms" | "checklists";

export default function DocumentsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<DocTab>("forms");
  const [forms, setForms] = useState<HyperForm[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<HyperForm | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create dialog state (forms)
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFields, setNewFields] = useState<HyperFormField[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create dialog state (checklists)
  const [clName, setClName] = useState("");
  const [clDescription, setClDescription] = useState("");
  const [clPasscode, setClPasscode] = useState("");
  const [clAllowEditing, setClAllowEditing] = useState(false);
  const [clItems, setClItems] = useState<{ label: string; quantity: string }[]>([]);

  useEffect(() => {
    Promise.all([getForms(), getChecklists()]).then(([formsRes, clRes]) => {
      setForms(formsRes.data ?? []);
      setChecklists(clRes.data ?? []);
      setLoading(false);
    });
  }, []);

  const filteredForms = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredChecklists = checklists.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateForm(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { data, error } = await createForm({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      fields: newFields,
    });
    setCreating(false);
    if (error) { setCreateError(error); return; }
    if (data) {
      setForms((prev) => [data, ...prev]);
      setSelectedForm(data);
    }
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    setNewFields([]);
  }

  async function handleCreateChecklist(e: React.FormEvent) {
    e.preventDefault();
    if (!clName.trim() || !clPasscode.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { data, error } = await createChecklist({
      name: clName.trim(),
      description: clDescription.trim() || undefined,
      passcode: clPasscode.trim(),
      allow_editing: clAllowEditing,
      items: clItems.filter((i) => i.label.trim()).map((i) => ({
        label: i.label.trim(),
        quantity: i.quantity.trim() || undefined,
      })),
    });
    setCreating(false);
    if (error) { setCreateError(error); return; }
    if (data) {
      setChecklists((prev) => [data, ...prev]);
      router.push(`/checklists/${data.id}/manage`);
    }
    setShowCreate(false);
    setClName("");
    setClDescription("");
    setClPasscode("");
    setClAllowEditing(false);
    setClItems([]);
  }

  function handleFormUpdated(updated: HyperForm) {
    setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setSelectedForm(updated);
  }

  function handleFormDeleted(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
    setSelectedForm(null);
  }

  function handleChecklistDeleted(id: string) {
    setChecklists((prev) => prev.filter((c) => c.id !== id));
  }

  const isChecklistTab = tab === "checklists";

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-6 md:-m-8">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div>
            <h1 className="text-base font-bold tracking-tight">Documents</h1>
            <p className="text-xs text-muted-foreground">Forms & Checklists</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 gap-1.5">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3">
          <button
            onClick={() => { setTab("forms"); setSelectedForm(null); }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "forms" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Forms
          </button>
          <button
            onClick={() => { setTab("checklists"); setSelectedForm(null); }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "checklists" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Checklists
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${isChecklistTab ? "checklists" : "forms"}…`}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isChecklistTab ? (
            filteredChecklists.length === 0 ? (
              <EmptyListState search={search} type="checklist" onCreate={() => setShowCreate(true)} />
            ) : (
              <AnimatePresence initial={false}>
                {filteredChecklists.map((cl) => (
                  <motion.button
                    key={cl.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => router.push(`/checklists/${cl.id}/manage`)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-colors group",
                      "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <ListChecks className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        "text-muted-foreground group-hover:text-indigo-400"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate leading-tight">{cl.name}</p>
                        {cl.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
                            {cl.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                            <Lock className="h-2.5 w-2.5" />
                            {cl.passcode}
                          </span>
                          <span className={cn(
                            "text-[10px] font-medium flex items-center gap-0.5",
                            cl.is_active ? "text-emerald-400" : "text-muted-foreground/50"
                          )}>
                            {cl.is_active
                              ? <><ToggleRight className="h-3 w-3" /> Active</>
                              : <><ToggleLeft className="h-3 w-3" /> Inactive</>
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            )
          ) : (
            filteredForms.length === 0 ? (
              <EmptyListState search={search} type="form" onCreate={() => setShowCreate(true)} />
            ) : (
              <AnimatePresence initial={false}>
                {filteredForms.map((form) => (
                  <motion.button
                    key={form.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setSelectedForm(form)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-colors group",
                      selectedForm?.id === form.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <FileText className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        selectedForm?.id === form.id ? "text-indigo-400" : "text-muted-foreground"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate leading-tight">{form.name}</p>
                        {form.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
                            {form.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/70">
                            {form.fields.length} field{form.fields.length !== 1 ? "s" : ""}
                          </span>
                          <span className={cn(
                            "text-[10px] font-medium flex items-center gap-0.5",
                            form.is_active ? "text-emerald-400" : "text-muted-foreground/50"
                          )}>
                            {form.is_active
                              ? <><ToggleRight className="h-3 w-3" /> Active</>
                              : <><ToggleLeft className="h-3 w-3" /> Inactive</>
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            )
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {isChecklistTab ? (
          <EmptyState type="checklist" onCreate={() => setShowCreate(true)} />
        ) : selectedForm ? (
          <FormDetail
            key={selectedForm.id}
            form={selectedForm}
            onUpdated={handleFormUpdated}
            onDeleted={handleFormDeleted}
          />
        ) : (
          <EmptyState type="form" onCreate={() => setShowCreate(true)} />
        )}
      </main>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!creating) setShowCreate(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isChecklistTab ? "Create New Checklist" : "Create New Form"}
            </DialogTitle>
            <DialogDescription>
              {isChecklistTab
                ? "Create a shareable checklist with passcode protection. Participants can check items and you'll see who claimed what."
                : "Design a lead capture form. Submissions will appear as contacts in your pipeline."}
            </DialogDescription>
          </DialogHeader>

          {isChecklistTab ? (
            <form onSubmit={handleCreateChecklist} className="space-y-5 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Checklist Name <span className="text-rose-400">*</span></Label>
                  <Input
                    value={clName}
                    onChange={(e) => setClName(e.target.value)}
                    placeholder="e.g. Community BBQ"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={clDescription}
                    onChange={(e) => setClDescription(e.target.value)}
                    placeholder="Optional short description"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Passcode <span className="text-rose-400">*</span></Label>
                  <Input
                    value={clPasscode}
                    onChange={(e) => setClPasscode(e.target.value)}
                    placeholder="e.g. BBQ2024"
                  />
                  <p className="text-xs text-muted-foreground">Participants need this to access the checklist.</p>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={clAllowEditing}
                    onCheckedChange={setClAllowEditing}
                  />
                  <Label className="text-sm">Allow participants to add items</Label>
                </div>
              </div>

              {/* Initial items */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Items (optional — you can add more later)</Label>
                <div className="space-y-2">
                  {clItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <Input
                        value={item.label}
                        onChange={(e) => {
                          const next = [...clItems];
                          next[i] = { ...next[i], label: e.target.value };
                          setClItems(next);
                        }}
                        placeholder="Item name (e.g. Hot dogs)"
                        className="h-8 text-sm flex-1"
                      />
                      <Input
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...clItems];
                          next[i] = { ...next[i], quantity: e.target.value };
                          setClItems(next);
                        }}
                        placeholder="qty"
                        className="h-8 text-sm w-20"
                      />
                      <button
                        type="button"
                        onClick={() => setClItems(clItems.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-rose-400 p-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setClItems([...clItems, { label: "", quantity: "" }])}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </Button>
                </div>
              </div>

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !clName.trim() || !clPasscode.trim()} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Checklist
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateForm} className="space-y-5 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Form Name <span className="text-rose-400">*</span></Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Contact Us"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional short description"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Fields</Label>
                <FormBuilder fields={newFields} onChange={setNewFields} />
              </div>

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !newName.trim()} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Form
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyListState({ search, type, onCreate }: { search: string; type: "form" | "checklist"; onCreate: () => void }) {
  const Icon = type === "checklist" ? ListChecks : FileText;
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <Icon className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">
        {search ? "No results" : `No ${type === "checklist" ? "checklists" : "forms"} yet`}
      </p>
      {!search && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreate}
          className="mt-2 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Create your first {type === "checklist" ? "checklist" : "form"}
        </Button>
      )}
    </div>
  );
}

function EmptyState({ type, onCreate }: { type: "form" | "checklist"; onCreate: () => void }) {
  const Icon = type === "checklist" ? ListChecks : FileText;
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
          <Icon className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold">
          Select a {type === "checklist" ? "checklist" : "form"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {type === "checklist"
            ? "Choose a checklist from the sidebar, or create a new one to start organizing."
            : "Choose a form from the sidebar, or create a new one to start capturing leads."}
        </p>
        <Button onClick={onCreate} className="mt-4 gap-2">
          <Plus className="h-4 w-4" />
          Create {type === "checklist" ? "Checklist" : "Form"}
        </Button>
      </div>
    </div>
  );
}
