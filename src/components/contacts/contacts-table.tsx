"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Mail, Phone, MoreHorizontal, X, GripVertical, Pencil, Trash2, Upload, Download, FileText, Loader2, AlertCircle } from "lucide-react";

// Unified data layer
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkUpdateStatus,
  batchImportContacts,
  type UiContact,
} from "@/lib/data/contacts";
import { useToast } from "@/hooks/use-toast";

// UUID generator for internal IDs (fallback only)
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
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

// Field type definitions
type FieldType = "text" | "email" | "number" | "date" | "url" | "select" | "textarea";

interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // for select type
}

// Compatible with UiContact from unified layer (id is string)
interface Contact {
  id: string;
  internalId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  lastContact: string;
  customFields: Record<string, string | number>;
  createdAt: string;
}

interface StatusConfig {
  id: string;
  label: string;
  color: string; // hex color
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

const defaultFieldDefinitions: FieldDefinition[] = [
  { id: "jobTitle", name: "Job Title", type: "text", required: false },
  { id: "industry", name: "Industry", type: "select", required: false, options: ["Technology", "Healthcare", "Finance", "Retail", "Manufacturing"] },
  { id: "annualRevenue", name: "Annual Revenue", type: "number", required: false },
  { id: "website", name: "Website", type: "url", required: false },
  { id: "birthday", name: "Birthday", type: "date", required: false },
  { id: "notes", name: "Notes", type: "textarea", required: false },
];

const initialContacts: Contact[] = [
  { id: "1", internalId: "550e8400-e29b-41d4-a716-446655440001", name: "Sarah Miller", email: "sarah@acme.com", phone: "+1 555-0192", company: "Acme Corp", status: "Customer", lastContact: "2 hours ago", customFields: { jobTitle: "CTO", industry: "Technology" }, createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: "2", internalId: "550e8400-e29b-41d4-a716-446655440002", name: "James Wilson", email: "james@beta.io", phone: "+1 555-0143", company: "Beta Inc", status: "Lead", lastContact: "1 day ago", customFields: { jobTitle: "VP Sales", industry: "Finance", annualRevenue: 5000000 }, createdAt: new Date(Date.now() - 86400000 * 45).toISOString() },
  { id: "3", internalId: "550e8400-e29b-41d4-a716-446655440003", name: "Emily Chen", email: "emily@gamma.co", phone: "+1 555-0178", company: "Gamma Ltd", status: "Prospect", lastContact: "3 hours ago", customFields: { jobTitle: "Product Manager", website: "https://gamma.co" }, createdAt: new Date(Date.now() - 86400000 * 20).toISOString() },
];

const defaultStatusConfigs: StatusConfig[] = [
  { id: "lead", label: "Lead", color: "#6366f1" },           // indigo-500
  { id: "prospect", label: "Prospect", color: "#f59e0b" },   // amber-500
  { id: "customer", label: "Customer", color: "#10b981" },   // emerald-500
  { id: "churned", label: "Churned", color: "#6b7280" },     // gray-500
];

export function ContactsTable() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<string>("all");
  
  // Data state - now loaded from unified layer
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hypercrm_fields");
      return saved ? JSON.parse(saved) : defaultFieldDefinitions;
    }
    return defaultFieldDefinitions;
  });
  
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hypercrm_statuses");
      if (saved) {
        try {
          const parsed: StatusConfig[] = JSON.parse(saved);
          // If saved configs contain invalid DB enum values, reset to defaults
          const VALID_DB_STATUSES = ["Lead", "Prospect", "Customer", "Churned"];
          const hasInvalid = parsed.some((s) => !VALID_DB_STATUSES.includes(s.label));
          if (hasInvalid) {
            localStorage.setItem("hypercrm_statuses", JSON.stringify(defaultStatusConfigs));
            return defaultStatusConfigs;
          }
          return parsed;
        } catch {
          return defaultStatusConfigs;
        }
      }
    }
    return defaultStatusConfigs;
  });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFieldConfigOpen, setIsFieldConfigOpen] = useState(false);
  const [isStatusConfigOpen, setIsStatusConfigOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  
  // Bulk selection state
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  
  // CSV upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Prevent hydration mismatch - only render dynamic colors after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load contacts from unified data layer on mount (Supabase if authed, else localStorage)
  useEffect(() => {
    async function loadContacts() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getContacts();
        setContacts((data && data.length > 0 ? data : initialContacts) as Contact[]);
      } catch (err) {
        console.error("Error loading contacts:", err);
        setLoadError("Failed to load contacts.");
        setContacts(initialContacts);
      } finally {
        setIsLoading(false);
      }
    }
    loadContacts();
  }, []);

  useEffect(() => {
    localStorage.setItem("hypercrm_fields", JSON.stringify(fieldDefinitions));
  }, [fieldDefinitions]);

  useEffect(() => {
    localStorage.setItem("hypercrm_statuses", JSON.stringify(statusConfigs));
  }, [statusConfigs]);

  // Form state for new contact - use first status as default
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    status: "",
    customFields: {},
  });

  // Form state for editing contact
  const [editContact, setEditContact] = useState<Partial<Contact>>({
    status: "",
    customFields: {},
  });

  // Status configuration form state
  const [newStatus, setNewStatus] = useState<Partial<StatusConfig>>({ color: "#6366f1" });
  const [editingStatus, setEditingStatus] = useState<StatusConfig | null>(null);
  const [newField, setNewField] = useState<Partial<FieldDefinition>>({ type: "text", required: false });
  const [newOption, setNewOption] = useState("");
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);

  // Use initial data during SSR to prevent hydration mismatch
  const displayContacts = mounted ? contacts : initialContacts;
  
  const filtered = displayContacts.filter((c) => {
    if (!search.trim()) return true;
    
    const searchLower = search.toLowerCase();
    
    switch (searchField) {
      case "all":
        return (
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.company.toLowerCase().includes(searchLower) ||
          c.phone.toLowerCase().includes(searchLower) ||
          Object.values(c.customFields).some((val) => 
            String(val).toLowerCase().includes(searchLower)
          )
        );
      case "name":
        return c.name.toLowerCase().includes(searchLower);
      case "email":
        return c.email.toLowerCase().includes(searchLower);
      case "company":
        return c.company.toLowerCase().includes(searchLower);
      case "phone":
        return c.phone.toLowerCase().includes(searchLower);
      case "status":
        return c.status.toLowerCase().includes(searchLower);
      default:
        // Search in specific custom field
        const fieldValue = c.customFields[searchField];
        return fieldValue ? String(fieldValue).toLowerCase().includes(searchLower) : false;
    }
  });

  const getStatusStyle = (statusLabel: string) => {
    const config = statusConfigs.find((s) => s.label === statusLabel);
    if (!config) return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
    
    // Convert hex to RGB for background with opacity
    const hex = config.color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return {
      bg: `rgba(${r}, ${g}, ${b}, 0.15)`,
      text: config.color,
      border: `rgba(${r}, ${g}, ${b}, 0.25)`,
    };
  };

  // Status config handlers
  const handleAddStatus = () => {
    if (!newStatus.label) return;
    const id = newStatus.label.toLowerCase().replace(/\s+/g, "_");
    const status: StatusConfig = {
      id,
      label: newStatus.label,
      color: newStatus.color || "#6366f1",
    };
    setStatusConfigs([...statusConfigs, status]);
    setNewStatus({ color: "#6366f1" });
  };

  const handleUpdateStatus = () => {
    if (!editingStatus || !editingStatus.label) return;
    setStatusConfigs(statusConfigs.map((s) => (s.id === editingStatus.id ? editingStatus : s)));
    setEditingStatus(null);
  };

  const handleRemoveStatus = (statusId: string) => {
    setStatusConfigs(statusConfigs.filter((s) => s.id !== statusId));
  };

  const handleSaveContact = async () => {
    if (!newContact.name || !newContact.email) {
      toast({ title: "Missing required fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const created = await createContact({
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone || "",
        company: newContact.company || "",
        status: newContact.status || statusConfigs[0]?.label || "Active",
        customFields: (newContact.customFields || {}) as Record<string, string>,
      });

      if (created) {
        setContacts([created as Contact, ...contacts]);
        setNewContact({ status: "", customFields: {} });
        setIsAddModalOpen(false);
        toast({ title: "Contact created", description: `${created.name} has been added.` });
      } else {
        toast({ title: "Error", description: "Failed to create contact.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error creating contact:", err);
      toast({ title: "Error creating contact", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddField = () => {
    if (!newField.name || !newField.type) return;

    const field: FieldDefinition = {
      id: `field_${Date.now()}`,
      name: newField.name,
      type: newField.type,
      required: newField.required || false,
      options: newField.type === "select" ? fieldOptions : undefined,
    };

    setFieldDefinitions([...fieldDefinitions, field]);
    setNewField({ type: "text", required: false });
    setFieldOptions([]);
    setNewOption("");
  };

  const handleRemoveField = (fieldId: string) => {
    setFieldDefinitions(fieldDefinitions.filter((f) => f.id !== fieldId));
  };

  // CSV handlers
  const handleGenerateTemplate = () => {
    // Build CSV headers based on current field definitions
    const standardHeaders = ["internalId", "name", "email", "phone", "company", "status"];
    const customHeaders = fieldDefinitions.map((f) => f.id);
    const allHeaders = [...standardHeaders, ...customHeaders];
    
    // Create sample row with empty values
    const sampleRow = allHeaders.map((h) => {
      if (h === "internalId") return ""; // Leave empty - will be generated by platform
      if (h === "status") return statusConfigs[0]?.label || "Active";
      return "";
    });
    
    const csvContent = [
      allHeaders.join(","),
      sampleRow.join(","),
    ].join("\n");
    
    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contact_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSVAndUpsert(text);
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = "";
  };

  const parseCSVAndUpsert = (csvText: string) => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      const emptyResults = {
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        rows: [{
          rowNumber: 0,
          name: "",
          email: "",
          status: "error" as const,
          action: "failed" as const,
          message: "CSV file appears to be empty or missing data rows (need at least header + 1 data row)",
        }],
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem("hypercrm_last_import", JSON.stringify(emptyResults));
      router.push("/contacts/import-results");
      return;
    }
    
    const headers = lines[0].split(",").map((h) => h.trim());
    const dataRows = lines.slice(1);
    
    const results: ImportRowResult[] = [];
    const importedContacts: Contact[] = [];
    const updatedContacts: Contact[] = [];
    
    dataRows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because row 1 is header
      
      // Simple CSV parsing (handles basic commas, not quoted fields)
      const values = row.split(",").map((v) => v.trim());
      const rowData: Record<string, string> = {};
      
      headers.forEach((header, i) => {
        rowData[header] = values[i] || "";
      });
      
      const internalId = rowData.internalId?.trim();
      const email = rowData.email?.trim();
      const name = rowData.name?.trim();
      
      // Validate required fields
      if (!email && !name) {
        results.push({
          rowNumber,
          name: name || "(empty)",
          email: email || "(empty)",
          status: "skipped",
          action: "skipped",
          message: "Row skipped: Both name and email are required fields",
        });
        return;
      }
      
      if (!email) {
        results.push({
          rowNumber,
          name: name || "(empty)",
          email: "(empty)",
          status: "error",
          action: "failed",
          message: "Failed: Email is a required field",
        });
        return;
      }
      
      if (!name) {
        results.push({
          rowNumber,
          name: "(empty)",
          email,
          status: "error",
          action: "failed",
          message: "Failed: Name is a required field",
        });
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.push({
          rowNumber,
          name,
          email,
          status: "error",
          action: "failed",
          message: `Failed: Invalid email format "${email}"`,
        });
        return;
      }
      
      try {
        // Check if contact exists (by internalId or email)
        const existingById = internalId ? contacts.find((c) => c.internalId === internalId) : null;
        const existingByEmail = contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
        const existing = existingById || existingByEmail;
        
        // Build custom fields from row data
        const customFields: Record<string, string | number> = {};
        const customFieldErrors: string[] = [];
        const createdOptions: string[] = [];
        const createdStatuses: string[] = [];
        
        // Check and create new status if needed
        const importedStatus = rowData.status?.trim();
        if (importedStatus) {
          const statusExists = statusConfigs.some((s) => s.label.toLowerCase() === importedStatus.toLowerCase());
          if (!statusExists) {
            // Create new status with a random color
            const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const newStatus: StatusConfig = {
              id: generateUUID(),
              label: importedStatus,
              color: randomColor,
            };
            setStatusConfigs((prev) => [...prev, newStatus]);
            createdStatuses.push(importedStatus);
          }
        }
        
        // Track field definitions that need updating
        const updatedFieldDefinitions = [...fieldDefinitions];
        let fieldsWereUpdated = false;
        
        fieldDefinitions.forEach((field, fieldIndex) => {
          const value = rowData[field.id];
          if (value) {
            if (field.type === "number") {
              const numValue = parseFloat(value);
              if (isNaN(numValue)) {
                customFieldErrors.push(`${field.name}: "${value}" is not a valid number`);
              } else {
                customFields[field.id] = numValue;
              }
            } else if (field.type === "email") {
              if (!emailRegex.test(value)) {
                customFieldErrors.push(`${field.name}: "${value}" is not a valid email`);
              } else {
                customFields[field.id] = value;
              }
            } else if (field.type === "url") {
              try {
                new URL(value);
                customFields[field.id] = value;
              } catch {
                customFieldErrors.push(`${field.name}: "${value}" is not a valid URL - make sure to include https:// or http:// prefix (e.g., https://example.com)`);
              }
            } else if (field.type === "select") {
              // For select fields (like industry), add new option if it doesn't exist
              const currentOptions = field.options || [];
              if (!currentOptions.includes(value)) {
                // Add the new option to the field definition
                updatedFieldDefinitions[fieldIndex] = {
                  ...field,
                  options: [...currentOptions, value],
                };
                fieldsWereUpdated = true;
                createdOptions.push(`${field.name}: "${value}"`);
              }
              customFields[field.id] = value;
            } else {
              customFields[field.id] = value;
            }
          }
        });
        
        // Update field definitions if new options were added
        if (fieldsWereUpdated) {
          setFieldDefinitions(updatedFieldDefinitions);
        }
        
        if (existing) {
          // Update existing contact
          const updated: Contact = {
            ...existing,
            name,
            email,
            phone: rowData.phone || existing.phone,
            company: rowData.company || existing.company,
            status: rowData.status || existing.status,
            customFields: { ...existing.customFields, ...customFields },
          };
          updatedContacts.push(updated);
          
          // Build success message with info about created options/statuses
          let messageParts: string[] = [];
          
          if (createdOptions.length > 0) {
            messageParts.push(`Added new options: ${createdOptions.join(", ")}`);
          }
          if (createdStatuses.length > 0) {
            messageParts.push(`Created new status: "${createdStatuses.join(", ")}"`);
          }
          if (customFieldErrors.length > 0) {
            messageParts.push(`Warnings: ${customFieldErrors.join("; ")}`);
          }
          if (messageParts.length === 0) {
            messageParts.push(`Updated existing contact (matched by ${existingById ? "Internal ID" : "Email"})`);
          }
          
          results.push({
            rowNumber,
            name,
            email,
            status: customFieldErrors.length > 0 ? "error" : "success",
            action: "updated",
            message: messageParts.join(" • "),
          });
        } else {
          // Create new contact
          const now = new Date().toISOString();
          const newContact: Contact = {
            id: generateUUID(), // Ensure unique IDs
            internalId: generateUUID(),
            name,
            email,
            phone: rowData.phone || "",
            company: rowData.company || "",
            status: rowData.status || statusConfigs[0]?.label || "Active",
            lastContact: "Just now",
            customFields,
            createdAt: now,
          };
          importedContacts.push(newContact);
          
          // Create initial activity for imported contact
          const creationActivity = {
            id: generateUUID(),
            type: "document" as const,
            title: "Contact created via import",
            description: `Contact profile imported for ${name}`,
            timestamp: now,
            author: "You",
          };
          localStorage.setItem(`hypercrm_activities_${newContact.id}`, JSON.stringify([creationActivity]));
          
          // Build success message with info about created options/statuses
          let messageParts: string[] = [];
          
          if (createdOptions.length > 0) {
            messageParts.push(`Added new options: ${createdOptions.join(", ")}`);
          }
          if (createdStatuses.length > 0) {
            messageParts.push(`Created new status: "${createdStatuses.join(", ")}"`);
          }
          if (customFieldErrors.length > 0) {
            messageParts.push(`Warnings: ${customFieldErrors.join("; ")}`);
          }
          if (messageParts.length === 0) {
            messageParts.push("Created new contact successfully");
          }
          
          results.push({
            rowNumber,
            name,
            email,
            status: customFieldErrors.length > 0 ? "error" : "success",
            action: "created",
            message: messageParts.join(" • "),
          });
        }
      } catch (error) {
        results.push({
          rowNumber,
          name,
          email,
          status: "error",
          action: "failed",
          message: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    });
    
    // Update state: merge updated contacts and add new ones
    if (updatedContacts.length > 0) {
      setContacts((prev) =>
        prev.map((c) => {
          const updated = updatedContacts.find((u) => u.internalId === c.internalId);
          return updated || c;
        })
      );
    }
    
    if (importedContacts.length > 0) {
      setContacts((prev) => [...importedContacts, ...prev]);
    }

    // Persist to backend (Supabase if authed, else localStorage handled by layer)
    if (importedContacts.length > 0) {
      batchImportContacts(
        importedContacts.map((c) => ({
          name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          status: c.status,
          customFields: c.customFields as Record<string, string>,
        }))
      ).catch((err) => console.error("Error persisting imported contacts:", err));
    }
    if (updatedContacts.length > 0) {
      Promise.all(
        updatedContacts.map((c) =>
          updateContact(c.id, {
            name: c.name,
            email: c.email,
            phone: c.phone,
            company: c.company,
            status: c.status,
            customFields: c.customFields as Record<string, string>,
          })
        )
      ).catch((err) => console.error("Error persisting updated contacts:", err));
    }
    
    // Calculate summary
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const createdCount = results.filter((r) => r.action === "created").length;
    const updatedCount = results.filter((r) => r.action === "updated").length;
    
    // Store results and navigate to results page
    const importResults = {
      totalRows: dataRows.length,
      successCount,
      errorCount,
      skippedCount,
      createdCount,
      updatedCount,
      rows: results,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem("hypercrm_last_import", JSON.stringify(importResults));
    router.push("/contacts/import-results");
  };

  const handleAddOption = () => {
    if (newOption && !fieldOptions.includes(newOption)) {
      setFieldOptions([...fieldOptions, newOption]);
      setNewOption("");
    }
  };

  // Edit contact handlers
  const handleEditClick = (contact: Contact) => {
    setSelectedContact(contact);
    setEditContact({ ...contact });
    setIsEditModalOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!editContact.name || !editContact.email || !selectedContact) return;

    setIsLoading(true);
    try {
      const result = await updateContact(selectedContact.id, {
        name: editContact.name,
        email: editContact.email,
        phone: editContact.phone || "",
        company: editContact.company || "",
        status: editContact.status || "Lead",
        customFields: (editContact.customFields || {}) as Record<string, string>,
      });

      if (result) {
        setContacts(contacts.map((c) => (c.id === selectedContact.id ? (result as Contact) : c)));
        setIsEditModalOpen(false);
        setSelectedContact(null);
        setEditContact({ status: "Lead", customFields: {} });
        toast({ title: "Contact updated", description: "Changes saved successfully." });
      } else {
        toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error updating contact:", err);
      toast({ title: "Error updating contact", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete contact handlers
  const handleDeleteClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedContact) return;
    setIsLoading(true);
    try {
      const success = await deleteContact(selectedContact.id);
      if (success) {
        setContacts(contacts.filter((c) => c.id !== selectedContact.id));
        toast({ title: "Contact deleted", description: `${selectedContact.name} has been removed.` });
      } else {
        toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error deleting contact:", err);
      toast({ title: "Error deleting contact", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedContact(null);
      setIsLoading(false);
    }
  };

  // Drag and drop handlers for field reordering
  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFieldIndex === null || draggedFieldIndex === index) return;

    const newFields = [...fieldDefinitions];
    const draggedField = newFields[draggedFieldIndex];
    newFields.splice(draggedFieldIndex, 1);
    newFields.splice(index, 0, draggedField);
    
    setFieldDefinitions(newFields);
    setDraggedFieldIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedFieldIndex(null);
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedContactIds.size === filtered.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleSelectContact = (contactId: string) => {
    const newSelection = new Set(selectedContactIds);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContactIds(newSelection);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedContactIds);
    setIsLoading(true);
    try {
      const success = await bulkDeleteContacts(ids);
      if (success) {
        setContacts(contacts.filter((c) => !selectedContactIds.has(c.id)));
        toast({ title: "Contacts deleted", description: `${ids.length} contacts removed.` });
      } else {
        toast({ title: "Error", description: "Failed to delete contacts.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error bulk deleting:", err);
      toast({ title: "Error deleting contacts", description: "Please try again.", variant: "destructive" });
    } finally {
      setSelectedContactIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      setIsLoading(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    const ids = Array.from(selectedContactIds);
    setIsLoading(true);
    try {
      const success = await bulkUpdateStatus(ids, newStatus);
      if (success) {
        setContacts(contacts.map((c) =>
          selectedContactIds.has(c.id) ? { ...c, status: newStatus } : c
        ));
        toast({ title: "Status updated", description: `${ids.length} contacts set to ${newStatus}.` });
      } else {
        toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error updating status:", err);
      toast({ title: "Error updating status", description: "Please try again.", variant: "destructive" });
    } finally {
      setSelectedContactIds(new Set());
      setIsLoading(false);
    }
  };

  const handleBulkExport = () => {
    const selectedContacts = contacts.filter((c) => selectedContactIds.has(c.id));
    
    // Build CSV headers
    const headers = ["Name", "Email", "Phone", "Company", "Status", "Last Contact"];
    const customFieldIds = fieldDefinitions.map((f) => f.id);
    headers.push(...fieldDefinitions.map((f) => f.name));
    
    // Build CSV rows
    const rows = selectedContacts.map((contact) => {
      const baseFields = [
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.status,
        contact.lastContact,
      ];
      const customFields = customFieldIds.map((id) => contact.customFields[id] || "");
      return [...baseFields, ...customFields].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",");
    });
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Render field input for edit mode
  const renderEditFieldInput = (field: FieldDefinition) => {
    const value = editContact.customFields?.[field.id] || "";

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
            placeholder={`Enter ${field.name.toLowerCase()}`}
            value={value as string}
            onChange={(e) => setEditContact({
              ...editContact,
              customFields: { ...editContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
      case "select":
        return (
          <Select
            value={value as string}
            onValueChange={(val) => {
              if (val) {
                setEditContact({
                  ...editContact,
                  customFields: { ...editContact.customFields, [field.id]: val },
                });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "number":
        return (
          <Input
            type="number"
            placeholder={`Enter ${field.name.toLowerCase()}`}
            value={value}
            onChange={(e) => setEditContact({
              ...editContact,
              customFields: { ...editContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setEditContact({
              ...editContact,
              customFields: { ...editContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
      default:
        return (
          <Input
            type={field.type}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            value={value}
            onChange={(e) => setEditContact({
              ...editContact,
              customFields: { ...editContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
    }
  };

  const renderFieldInput = (field: FieldDefinition) => {
    const value = newContact.customFields?.[field.id] || "";
    const baseClasses = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            className={`${baseClasses} min-h-[80px] resize-y`}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            value={value as string}
            onChange={(e) => setNewContact({
              ...newContact,
              customFields: { ...newContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
      case "select":
        return (
          <Select
            value={value as string}
            onValueChange={(val) => {
              if (val) {
                setNewContact({
                  ...newContact,
                  customFields: { ...newContact.customFields, [field.id]: val },
                });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "number":
        return (
          <Input
            type="number"
            placeholder={`Enter ${field.name.toLowerCase()}`}
            value={value}
            onChange={(e) => setNewContact({
              ...newContact,
              customFields: { ...newContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setNewContact({
              ...newContact,
              customFields: { ...newContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
      default:
        return (
          <Input
            type={field.type}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            value={value}
            onChange={(e) => setNewContact({
              ...newContact,
              customFields: { ...newContact.customFields, [field.id]: e.target.value },
            })}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {loadError}
        </div>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Syncing contacts...
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 w-full sm:max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchField === "all" ? "Search all fields..." : `Search by ${searchField === "name" ? "Name" : searchField === "email" ? "Email" : searchField === "company" ? "Company" : searchField === "phone" ? "Phone" : searchField === "status" ? "Status" : fieldDefinitions.find(f => f.id === searchField)?.name || "Field"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={searchField} onValueChange={(val) => val && setSearchField(val)}>
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue placeholder="Search by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              {fieldDefinitions.map((field) => (
                <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Dialog open={isStatusConfigOpen} onOpenChange={setIsStatusConfigOpen}>
            <DialogTrigger>
              <div className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none h-8 gap-1.5 px-2.5 cursor-pointer hover:bg-muted">
                Configure Statuses
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Configure Statuses</DialogTitle>
                <DialogDescription>
                  Customize status options and their colors.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 py-4">
                  {/* Existing Statuses */}
                  <div className="space-y-2">
                    <Label>Existing Statuses</Label>
                    <div className="space-y-2">
                      {statusConfigs.map((status) => (
                        <div key={status.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <input
                            type="color"
                            value={status.color}
                            onChange={(e) => {
                              const updated = statusConfigs.map((s) =>
                                s.id === status.id ? { ...s, color: e.target.value } : s
                              );
                              setStatusConfigs(updated);
                            }}
                            className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 overflow-hidden"
                            title="Click to change color"
                          />
                          {editingStatus?.id === status.id ? (
                            <Input
                              value={editingStatus.label}
                              onChange={(e) => setEditingStatus({ ...editingStatus, label: e.target.value })}
                              onBlur={handleUpdateStatus}
                              onKeyDown={(e) => e.key === "Enter" && handleUpdateStatus()}
                              className="flex-1 h-8"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="flex-1 text-sm font-medium cursor-pointer"
                              onClick={() => setEditingStatus(status)}
                            >
                              {status.label}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveStatus(status.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Add New Status */}
                  <div className="space-y-3">
                    <Label>Add New Status</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={newStatus.color}
                        onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 shrink-0 overflow-hidden"
                        title="Choose status color"
                      />
                      <Input
                        placeholder="Status name (e.g., Qualified)"
                        value={newStatus.label || ""}
                        onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleAddStatus()}
                        className="flex-1"
                      />
                      <Button onClick={handleAddStatus} size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogClose render={<Button variant="secondary" className="w-full">Done</Button>} />
            </DialogContent>
          </Dialog>

          {/* CSV Upload Button */}
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>

          {/* Generate Template Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateTemplate}
            className="h-8 gap-1.5"
          >
            <Download className="h-4 w-4" />
            Template
          </Button>

          <Dialog open={isFieldConfigOpen} onOpenChange={setIsFieldConfigOpen}>
            <DialogTrigger>
              <div className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none h-8 gap-1.5 px-2.5 cursor-pointer hover:bg-muted">
                Configure Fields
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Configure Contact Fields</DialogTitle>
                <DialogDescription>
                  Add custom fields to capture additional contact information.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 py-4">
                  {/* Existing Fields */}
                  <div className="space-y-2">
                    <Label>Existing Fields</Label>
                    <div className="space-y-2">
                      {fieldDefinitions.map((field, index) => (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-move transition-all ${draggedFieldIndex === index ? 'opacity-50 ring-2 ring-primary' : ''}`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{field.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{field.type}{field.required && " • Required"}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveField(field.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Add New Field */}
                  <div className="space-y-3">
                    <Label>Add New Field</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="Field name (e.g., Job Title)"
                        value={newField.name || ""}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                      />
                      <Select
                        value={newField.type}
                        onValueChange={(val) => val && setNewField({ ...newField, type: val as FieldType })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="url">URL</SelectItem>
                          <SelectItem value="select">Select (Dropdown)</SelectItem>
                          <SelectItem value="textarea">Textarea</SelectItem>
                        </SelectContent>
                      </Select>

                      {newField.type === "select" && (
                        <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                          <Label className="text-xs">Options</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add option"
                              value={newOption}
                              onChange={(e) => setNewOption(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
                            />
                            <Button type="button" size="sm" onClick={handleAddOption}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {fieldOptions.map((opt) => (
                              <Badge key={opt} variant="secondary" className="text-xs">
                                {opt}
                                <button
                                  onClick={() => setFieldOptions(fieldOptions.filter((o) => o !== opt))}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="required"
                          checked={newField.required}
                          onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                          className="rounded border-input"
                        />
                        <Label htmlFor="required" className="text-sm font-normal cursor-pointer">
                          Required field
                        </Label>
                      </div>

                      <Button onClick={handleAddField} className="w-full">
                        Add Field
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogClose render={<Button variant="secondary" className="w-full">Done</Button>} />
            </DialogContent>
          </Dialog>

          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger>
              <div className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none h-8 gap-1.5 px-2.5 cursor-pointer">
                <Plus className="mr-1 h-4 w-4" />
                Add Contact
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
                <DialogDescription>
                  Create a new contact with standard and custom fields.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 py-4 pr-4">
                  {/* Standard Fields */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Standard Information</Label>
                    <Input
                      placeholder="Full name *"
                      value={newContact.name || ""}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email address *"
                      value={newContact.email || ""}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                    <Input
                      placeholder="Phone number"
                      value={newContact.phone || ""}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    />
                    <Input
                      placeholder="Company"
                      value={newContact.company || ""}
                      onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    />
                    <Select
                      value={newContact.status}
                      onValueChange={(val) => val && setNewContact({ ...newContact, status: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusConfigs.map((s) => (
                          <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Fields */}
                  {fieldDefinitions.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Custom Fields</Label>
                        {fieldDefinitions.map((field) => (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">
                              {field.name}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {renderFieldInput(field)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose render={<Button variant="secondary">Cancel</Button>} />
                <Button onClick={handleSaveContact}>Save Contact</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Contact Dialog */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-lg max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Edit Contact</DialogTitle>
                <DialogDescription>
                  Update contact information and custom fields.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 py-4 pr-4">
                  {/* Standard Fields */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Standard Information</Label>
                    <Input
                      placeholder="Full name *"
                      value={editContact.name || ""}
                      onChange={(e) => setEditContact({ ...editContact, name: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email address *"
                      value={editContact.email || ""}
                      onChange={(e) => setEditContact({ ...editContact, email: e.target.value })}
                    />
                    <Input
                      placeholder="Phone number"
                      value={editContact.phone || ""}
                      onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                    />
                    <Input
                      placeholder="Company"
                      value={editContact.company || ""}
                      onChange={(e) => setEditContact({ ...editContact, company: e.target.value })}
                    />
                    <Select
                      value={editContact.status}
                      onValueChange={(val) => val && setEditContact({ ...editContact, status: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusConfigs.map((s) => (
                          <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Fields */}
                  {fieldDefinitions.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Custom Fields</Label>
                        {fieldDefinitions.map((field) => (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">
                              {field.name}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {renderEditFieldInput(field)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose render={<Button variant="secondary">Cancel</Button>} />
                <Button onClick={handleUpdateContact}>Update Contact</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Contact</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{selectedContact?.name}</strong>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose render={<Button variant="secondary">Cancel</Button>} />
                <Button variant="destructive" onClick={handleConfirmDelete}>Delete Contact</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Delete Confirmation Dialog */}
          <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Multiple Contacts</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{selectedContactIds.size} contacts</strong>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose render={<Button variant="secondary">Cancel</Button>} />
                <Button variant="destructive" onClick={handleBulkDelete}>
                  Delete {selectedContactIds.size} Contacts
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedContactIds.size > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedContactIds.size === filtered.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="font-medium">
              {selectedContactIds.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value=""
              onValueChange={(val) => val && handleBulkStatusChange(val)}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {statusConfigs.map((s) => (
                  <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleBulkExport} className="h-8">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              className="h-8"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={filtered.length > 0 && selectedContactIds.size === filtered.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              {/* Use default fields during SSR, then switch to stored fields after mount */}
              {(mounted ? fieldDefinitions : defaultFieldDefinitions).slice(0, 2).map((field) => (
                <TableHead key={field.id}>{field.name}</TableHead>
              ))}
              <TableHead>Status</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((contact) => (
              <TableRow
                key={contact.id}
                className={`border-b border-border transition-colors hover:bg-muted/50 ${selectedContactIds.has(contact.id) ? "bg-muted" : ""}`}
              >
                <TableCell className="w-[40px]">
                  <Checkbox
                    checked={selectedContactIds.has(contact.id)}
                    onCheckedChange={() => handleSelectContact(contact.id)}
                  />
                </TableCell>
                <TableCell>
                  <div
                    className="cursor-pointer"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    <p className="font-medium hover:text-primary transition-colors">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.email}</p>
                  </div>
                </TableCell>
                <TableCell>{contact.company}</TableCell>
                {/* Use default fields during SSR, then switch to stored fields after mount */}
                {(mounted ? fieldDefinitions : defaultFieldDefinitions).slice(0, 2).map((field) => (
                  <TableCell key={field.id} className="text-muted-foreground">
                    {contact.customFields[field.id] || "—"}
                  </TableCell>
                ))}
                <TableCell>
                  {mounted ? (() => {
                    const style = getStatusStyle(contact.status);
                    return (
                      <Badge 
                        variant="outline" 
                        className="border"
                        style={{ 
                          backgroundColor: style.bg, 
                          color: style.text, 
                          borderColor: style.border 
                        }}
                      >
                        {contact.status}
                      </Badge>
                    );
                  })() : (
                    <Badge variant="outline" className="border">
                      {contact.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.lastContact}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon-xs">
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <div className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-muted cursor-pointer">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/contacts/${contact.id}`)}>
                          <FileText className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditClick(contact)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteClick(contact)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
