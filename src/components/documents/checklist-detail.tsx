"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Edit3,
  Save,
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ListChecks,
  Plus,
  Trash2,
  Lock,
  Unlock,
  ToggleLeft,
  ToggleRight,
  Users,
  ImagePlus,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/communications/rich-text-editor";
import { cn } from "@/lib/utils";
import {
  getChecklistById,
  updateChecklist,
  deleteChecklist,
  addChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
  uploadChecklistBanner,
  removeChecklistParticipant,
  type ChecklistWithDetails,
  type ChecklistItem,
  type ChecklistItemField,
  type ChecklistParticipant,
} from "@/app/actions/checklists";

interface ChecklistDetailProps {
  checklistId: string;
  onDeleted: (id: string) => void;
}

export function ChecklistDetail({ checklistId, onDeleted }: ChecklistDetailProps) {
  const [data, setData] = useState<ChecklistWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [passcode, setPasscode] = useState("");
  const [allowEditing, setAllowEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  // Inline editing state for items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editFields, setEditFields] = useState<ChecklistItemField[]>([]);
  const [savingItem, setSavingItem] = useState(false);

  function startEditItem(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditLabel(item.label);
    setEditQty(item.quantity ?? "");
    setEditFields(item.fields ?? []);
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditLabel("");
    setEditQty("");
    setEditFields([]);
  }

  async function saveEditItem(itemId: string) {
    setSavingItem(true);
    await updateChecklistItem(itemId, {
      label: editLabel.trim(),
      quantity: editQty.trim() || null,
      fields: editFields.filter((f) => f.label.trim()),
    });
    setSavingItem(false);
    // Update local state
    if (data) {
      setData({
        ...data,
        items: data.items.map((i) =>
          i.id === itemId
            ? { ...i, label: editLabel.trim(), quantity: editQty.trim() || null, fields: editFields.filter((f) => f.label.trim()) }
            : i
        ),
      });
    }
    cancelEditItem();
  }

  function addEditField() {
    setEditFields([...editFields, { id: crypto.randomUUID(), label: "", value: "" }]);
  }

  function updateEditField(idx: number, key: "label" | "value", val: string) {
    setEditFields(editFields.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
  }

  function removeEditField(idx: number) {
    setEditFields(editFields.filter((_, i) => i !== idx));
  }

  const load = useCallback(async () => {
    const { data: d } = await getChecklistById(checklistId);
    setData(d);
    if (d) {
      setName(d.name);
      setDescription(d.description ?? "");
      setPasscode(d.passcode);
      setAllowEditing(d.allow_editing);
    }
    setLoading(false);
  }, [checklistId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const checklistUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checklists/${checklistId}`
      : `/checklists/${checklistId}`;

  function copyLink() {
    navigator.clipboard.writeText(checklistUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const { data: updated } = await updateChecklist(data.id, {
      name,
      description: description || undefined,
      passcode,
      allow_editing: allowEditing,
    });
    setSaving(false);
    if (updated) {
      setData({ ...data, ...updated });
      setEditing(false);
    }
  }

  async function handleToggleActive() {
    if (!data) return;
    const { data: updated } = await updateChecklist(data.id, { is_active: !data.is_active });
    if (updated) setData({ ...data, ...updated });
  }

  async function handleDelete() {
    if (!data) return;
    const { error } = await deleteChecklist(data.id);
    if (!error) onDeleted(data.id);
  }

  async function handleAddItem() {
    if (!data || !newItemLabel.trim()) return;
    setAddingItem(true);
    const { data: item } = await addChecklistItem(data.id, newItemLabel.trim(), newItemQty.trim() || undefined);
    setAddingItem(false);
    if (item) {
      setData({ ...data, items: [...data.items, item] });
    }
    setNewItemLabel("");
    setNewItemQty("");
  }

  async function handleDeleteItem(itemId: string) {
    if (!data) return;
    await deleteChecklistItem(itemId);
    setData({ ...data, items: data.items.filter((i) => i.id !== itemId) });
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!data || !e.target.files?.[0]) return;
    setUploadingBanner(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    const { url, error } = await uploadChecklistBanner(data.id, formData);
    setUploadingBanner(false);
    if (error) return;
    if (url) setData({ ...data, banner_image: url });
  }

  async function handleRemoveBanner() {
    if (!data) return;
    const { data: updated } = await updateChecklist(data.id, { banner_image: null });
    if (updated) setData({ ...data, banner_image: null });
  }

  async function handleRemoveParticipant(participantId: string) {
    if (!data) return;
    const { error } = await removeChecklistParticipant(data.id, participantId);
    if (error) return;
    setData({
      ...data,
      participants: data.participants.filter((p) => p.id !== participantId),
      checks: data.checks.filter((c) => c.participant_id !== participantId),
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Checklist not found.
      </div>
    );
  }

  // Group checks by item
  const checksByItem = new Map<string, ChecklistParticipant[]>();
  for (const check of data.checks) {
    const arr = checksByItem.get(check.item_id) ?? [];
    if (check.participant) arr.push(check.participant);
    checksByItem.set(check.item_id, arr);
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Banner image */}
      {data.banner_image ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img
            src={data.banner_image}
            alt="Banner"
            className="w-full h-40 object-cover"
          />
          <button
            onClick={handleRemoveBanner}
            className="absolute top-2 right-2 rounded-lg bg-black/60 backdrop-blur p-1.5 text-white hover:bg-black/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 cursor-pointer hover:bg-secondary/30 transition-colors text-sm text-muted-foreground">
          {uploadingBanner ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
          ) : (
            <><ImagePlus className="h-4 w-4" /> Add banner image</>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            className="hidden"
            disabled={uploadingBanner}
          />
        </label>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {editing ? (
          <div className="w-full space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold h-9"
              placeholder="Checklist name"
            />
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Description (optional) — add details, formatting, links…"
            />
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Passcode</Label>
                <Input
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="h-8 w-40 text-sm"
                  placeholder="e.g. BBQ2024"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={allowEditing}
                  onCheckedChange={setAllowEditing}
                />
                <Label className="text-xs flex items-center gap-1">
                  {allowEditing ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  Allow editing
                </Label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <>
              <h2 className="text-lg font-semibold truncate">{data.name}</h2>
              {data.description && (
                <div
                  className="prose prose-sm prose-invert max-w-none text-muted-foreground mt-1 [&_p]:my-1 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_a]:text-indigo-400"
                  dangerouslySetInnerHTML={{ __html: data.description }}
                />
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                  <Lock className="h-3 w-3" />
                  Passcode: {data.passcode}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  data.allow_editing ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary text-muted-foreground"
                )}>
                  {data.allow_editing ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {data.allow_editing ? "Editing enabled" : "Editing disabled"}
                </span>
              </div>
            </>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleToggleActive}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              data.is_active
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {data.is_active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            {data.is_active ? "Active" : "Inactive"}
          </button>

          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 h-8">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy link"}
          </Button>

          <a href={checklistUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </Button>
          </a>

          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); load(); }} className="gap-1.5 h-8">
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 h-8">
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-rose-400">Delete?</span>
              <Button variant="destructive" size="sm" onClick={handleDelete} className="h-7 px-2 text-xs">Yes</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 px-2 text-xs">No</Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 h-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Share URL bar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
        <span className="text-xs text-muted-foreground shrink-0">Public URL:</span>
        <span className="flex-1 text-xs font-mono text-foreground/80 truncate">{checklistUrl}</span>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {data.items.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="text-center">
              <ListChecks className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No items yet. Add some below.</p>
            </div>
          </div>
        ) : (
          <>
            {data.items.map((item, i) => {
              const checkers = checksByItem.get(item.id) ?? [];
              const isEditing = editingItemId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card px-4 py-3"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">{i + 1}.</span>
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="h-8 text-sm flex-1"
                          placeholder="Item label"
                          autoFocus
                        />
                        <Input
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="h-8 text-sm w-20"
                          placeholder="qty"
                        />
                      </div>
                      {editFields.map((field, fi) => (
                        <div key={field.id} className="flex items-center gap-2 pl-8">
                          <Input
                            value={field.label}
                            onChange={(e) => updateEditField(fi, "label", e.target.value)}
                            className="h-7 text-xs w-32"
                            placeholder="Field name"
                          />
                          <Input
                            value={field.value}
                            onChange={(e) => updateEditField(fi, "value", e.target.value)}
                            className="h-7 text-xs flex-1"
                            placeholder="Value"
                          />
                          <button
                            onClick={() => removeEditField(fi)}
                            className="text-muted-foreground hover:text-rose-400 p-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pl-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={addEditField}
                          className="h-7 gap-1 text-xs text-muted-foreground"
                        >
                          <Plus className="h-3 w-3" />
                          Add field
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <Button
                          size="sm"
                          onClick={() => saveEditItem(item.id)}
                          disabled={savingItem || !editLabel.trim()}
                          className="h-7 gap-1 text-xs"
                        >
                          {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditItem}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          {item.quantity && (
                            <span className="text-xs text-muted-foreground">qty: {item.quantity}</span>
                          )}
                        </div>
                        {item.fields && item.fields.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {item.fields.map((f) => (
                              <span key={f.id} className="text-[11px] text-muted-foreground">
                                <span className="text-muted-foreground/60">{f.label}:</span>{" "}
                                <span className="text-foreground/80">{f.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {checkers.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-2">
                              {checkers.slice(0, 5).map((p) => (
                                <div
                                  key={p.id}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-white"
                                  style={{ backgroundColor: p.avatar_color }}
                                  title={p.display_name}
                                >
                                  {p.display_name.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                            </div>
                            {checkers.length > 5 && (
                              <span className="text-xs text-muted-foreground">+{checkers.length - 5}</span>
                            )}
                            <span className="text-xs text-emerald-400 ml-1">
                              {checkers.length} checked
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Unchecked</span>
                        )}
                      </div>
                      <button
                        onClick={() => startEditItem(item)}
                        className="ml-1 rounded p-1 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="rounded p-1 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Add item */}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3">
          <Input
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            placeholder="New item label…"
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
          />
          <Input
            value={newItemQty}
            onChange={(e) => setNewItemQty(e.target.value)}
            placeholder="qty"
            className="h-8 text-sm w-20"
            onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
          />
          <Button
            size="sm"
            onClick={handleAddItem}
            disabled={addingItem || !newItemLabel.trim()}
            className="h-8 gap-1.5"
          >
            {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </Button>
        </div>
      </div>

      {/* Participants summary */}
      {data.participants.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Participants ({data.participants.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.participants.map((p) => {
              const checkCount = data.checks.filter((c) => c.participant_id === p.id).length;
              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5"
                >
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: p.avatar_color }}
                  >
                    {p.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium">{p.display_name}</span>
                  <span className="text-[10px] text-muted-foreground">{checkCount} checks</span>
                  <button
                    onClick={() => handleRemoveParticipant(p.id)}
                    className="ml-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove participant"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
