"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Mail, Phone, MoreHorizontal, X, GripVertical, Pencil, Trash2, Upload, Download, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// Server Actions
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkUpdateStatus,
  batchImportContacts,
  type Contact as DbContact,
  type CreateContactInput,
} from "@/app/actions/contacts";

// Types
type FieldType = "text" | "email" | "number" | "date" | "url" | "select" | "textarea";

interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  lastContact: string;
  customFields: Record<string, string | number>;
  createdAt: string;
  _dbData: DbContact;
}

interface StatusConfig {
  id: string;
  label: string;
  color: string;
}

interface ImportRowResult {
  rowNumber: number;
  name: string;
  email: string;
  status: "success" | "error" | "skipped";
  action: "created" | "updated" | "failed" | "skipped";
  message: string;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  createdCount: number;
  updatedCount: number;
  rows: ImportRowResult[];
}

// Helpers
function transformDbContact(dbContact: DbContact): Contact {
  return {
    id: dbContact.id,
    name: `${dbContact.first_name} ${dbContact.last_name}`,
    email: dbContact.email,
    phone: dbContact.phone || "",
    company: dbContact.company || "",
    status: dbContact.status,
    lastContact: formatTimeAgo(dbContact.created_at),
    customFields: dbContact.custom_fields as Record<string, string | number>,
    createdAt: dbContact.created_at,
    _dbData: dbContact,
  };
}

function transformToDbInput(contact: Partial<Contact>): CreateContactInput {
  const nameParts = contact.name?.split(" ") || ["", ""];
  return {
    first_name: nameParts[0] || "",
    last_name: nameParts.slice(1).join(" ") || "",
    email: contact.email || "",
    phone: contact.phone,
    company: contact.company,
    status: (contact.status as DbContact["status"]) || "Lead",
    custom_fields: contact.customFields || {},
  };
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

// Default configs
const defaultFieldDefinitions: FieldDefinition[] = [
  { id: "jobTitle", name: "Job Title", type: "text", required: false },
  { id: "industry", name: "Industry", type: "select", required: false, options: ["Technology", "Healthcare", "Finance", "Retail", "Manufacturing"] },
  { id: "annualRevenue", name: "Annual Revenue", type: "number", required: false },
  { id: "website", name: "Website", type: "url", required: false },
  { id: "birthday", name: "Birthday", type: "date", required: false },
  { id: "notes", name: "Notes", type: "textarea", required: false },
];

const defaultStatusConfigs: StatusConfig[] = [
  { id: "lead", label: "Lead", color: "#6366f1" },
  { id: "prospect", label: "Prospect", color: "#f59e0b" },
  { id: "customer", label: "Customer", color: "#10b981" },
  { id: "churned", label: "Churned", color: "#6b7280" },
];

export function ContactsTable() {
  // ... (component implementation will be added in chunks)
  return <div>Loading...</div>;
}
