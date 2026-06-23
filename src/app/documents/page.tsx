"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FileText,
  Loader2,
  Search,
  ToggleRight,
  ToggleLeft,
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
import { FormDetail } from "@/components/documents/form-detail";
import { FormBuilder } from "@/components/documents/form-builder";
import { getForms, createForm, type HyperForm } from "@/app/actions/forms";
import type { HyperFormField } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export default function DocumentsPage() {
  const [forms, setForms] = useState<HyperForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<HyperForm | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create dialog state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFields, setNewFields] = useState<HyperFormField[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    getForms().then(({ data }) => {
      setForms(data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
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

  function handleUpdated(updated: HyperForm) {
    setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setSelectedForm(updated);
  }

  function handleDeleted(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
    setSelectedForm(null);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-6 md:-m-8">
      {/* ── Sidebar: form list ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-sidebar">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div>
            <h1 className="text-base font-bold tracking-tight">HyperForms</h1>
            <p className="text-xs text-muted-foreground">Custom lead capture forms</p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="h-8 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Form list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? "No forms match your search" : "No forms yet"}
              </p>
              {!search && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(true)}
                  className="mt-2 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create your first form
                </Button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((form) => (
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
          )}
        </div>
      </aside>

      {/* ── Main content: form detail ── */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {selectedForm ? (
          <FormDetail
            key={selectedForm.id}
            form={selectedForm}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <FileText className="h-8 w-8 text-indigo-400" />
              </div>
              <h2 className="text-lg font-semibold">Select a form</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a form from the sidebar, or create a new one to start capturing leads.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Form
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* ── Create form dialog ── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!creating) setShowCreate(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>
              Design a lead capture form. Submissions will appear as contacts in your pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-5 mt-2">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
