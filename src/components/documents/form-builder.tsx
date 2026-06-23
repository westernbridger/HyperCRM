"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Type,
  Mail,
  Phone,
  Hash,
  AlignLeft,
  List,
  CheckSquare,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { HyperFormField, HyperFormFieldType } from "@/lib/supabase/database.types";

const FIELD_TYPES: { value: HyperFormFieldType; label: string; icon: React.ElementType }[] = [
  { value: "text",     label: "Short Text",  icon: Type },
  { value: "email",    label: "Email",        icon: Mail },
  { value: "phone",    label: "Phone",        icon: Phone },
  { value: "number",   label: "Number",       icon: Hash },
  { value: "textarea", label: "Long Text",    icon: AlignLeft },
  { value: "select",   label: "Dropdown",     icon: List },
  { value: "checkbox", label: "Checkbox",     icon: CheckSquare },
  { value: "date",     label: "Date",         icon: Calendar },
];

const MAPS_TO_OPTIONS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name",  label: "Last Name" },
  { value: "email",      label: "Email" },
  { value: "phone",      label: "Phone" },
  { value: "company",    label: "Company" },
];

function newField(): HyperFormField {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
    maps_to: null,
  };
}

interface FormBuilderProps {
  fields: HyperFormField[];
  onChange: (fields: HyperFormField[]) => void;
}

export function FormBuilder({ fields, onChange }: FormBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function addField() {
    const f = newField();
    onChange([...fields, f]);
    setExpandedId(f.id);
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function updateField(id: string, patch: Partial<HyperFormField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addOption(fieldId: string) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, { options: [...(field.options ?? []), ""] });
  }

  function updateOption(fieldId: string, index: number, value: string) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    const opts = [...(field.options ?? [])];
    opts[index] = value;
    updateField(fieldId, { options: opts });
  }

  function removeOption(fieldId: string, index: number) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, { options: (field.options ?? []).filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {fields.map((field, index) => {
          const TypeIcon = FIELD_TYPES.find((t) => t.value === field.type)?.icon ?? Type;
          const isExpanded = expandedId === field.id;

          return (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "rounded-xl border border-border bg-card overflow-hidden",
                isExpanded && "ring-1 ring-indigo-500/30"
              )}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : field.id)}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <TypeIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="flex-1 text-sm font-medium truncate">
                  {field.label || <span className="text-muted-foreground italic">Untitled field</span>}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {FIELD_TYPES.find((t) => t.value === field.type)?.label}
                </span>
                {field.required && (
                  <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                    required
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                  className="ml-1 rounded p-1 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180"
                )} />
              </div>

              {/* Expanded config */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border px-4 py-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Label */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Field Label</Label>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="e.g. Full Name"
                            className="h-8 text-sm"
                          />
                        </div>

                        {/* Type */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Field Type</Label>
                          <Select
                            value={field.type}
                            onValueChange={(v) => updateField(field.id, { type: v as HyperFormFieldType })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  <div className="flex items-center gap-2">
                                    <t.icon className="h-3.5 w-3.5" />
                                    {t.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Placeholder */}
                        {field.type !== "checkbox" && field.type !== "select" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Placeholder</Label>
                            <Input
                              value={field.placeholder ?? ""}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              placeholder="e.g. Enter your name"
                              className="h-8 text-sm"
                            />
                          </div>
                        )}

                        {/* Maps to */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Maps to contact field</Label>
                          <Select
                            value={field.maps_to ?? "__none__"}
                            onValueChange={(v) =>
                              updateField(field.id, {
                                maps_to: v === "__none__" ? null : (v as HyperFormField["maps_to"]),
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="— none —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— none —</SelectItem>
                              {MAPS_TO_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Required toggle */}
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`req-${field.id}`}
                          checked={field.required}
                          onCheckedChange={(v) => updateField(field.id, { required: v })}
                        />
                        <Label htmlFor={`req-${field.id}`} className="text-xs cursor-pointer">
                          Required field
                        </Label>
                      </div>

                      {/* Options (select) */}
                      {field.type === "select" && (
                        <div className="space-y-2">
                          <Label className="text-xs">Options</Label>
                          {(field.options ?? []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => updateOption(field.id, i, e.target.value)}
                                placeholder={`Option ${i + 1}`}
                                className="h-8 text-sm"
                              />
                              <button
                                onClick={() => removeOption(field.id, i)}
                                className="shrink-0 rounded p-1 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addOption(field.id)}
                            className="gap-1.5 text-xs h-7"
                          >
                            <Plus className="h-3 w-3" />
                            Add option
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addField}
        className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground mt-2"
      >
        <Plus className="h-4 w-4" />
        Add Field
      </Button>
    </div>
  );
}
