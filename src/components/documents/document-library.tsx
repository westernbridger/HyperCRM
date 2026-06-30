"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Link2,
  Loader2,
  AlertCircle,
  X,
  Paperclip,
  FileType,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
  linkDocumentToContact,
  updateDocumentCategory,
} from "@/app/actions/documents";
import { getContacts } from "@/app/actions/contacts";
import type { DocumentFile, DocumentCategory } from "@/lib/supabase/database.types";
import { cn, formatFileSize } from "@/lib/utils";

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "proposal", label: "Proposal" },
  { value: "resume", label: "Resume" },
  { value: "image", label: "Image" },
  { value: "other", label: "Other" },
];

function getFileIcon(fileType: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
    return ImageIcon;
  if (ext === "pdf" || fileType.includes("pdf")) return FileType;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["doc", "docx"].includes(ext)) return FileType;
  return File;
}

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  general: "text-zinc-400",
  contract: "text-rose-400",
  invoice: "text-emerald-400",
  proposal: "text-indigo-400",
  resume: "text-amber-400",
  image: "text-sky-400",
  other: "text-purple-400",
};

type ContactOption = { id: string; label: string };

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | "all">("all");
  const [previewDoc, setPreviewDoc] = useState<DocumentFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [linkTarget, setLinkTarget] = useState<DocumentFile | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>("__none");
  const [linking, setLinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await getDocuments();
    setDocuments(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadContacts() {
    const { data } = await getContacts();
    setContacts(
      (data ?? []).map((c: any) => ({
        id: c.id,
        label: `${c.first_name} ${c.last_name}`.trim(),
      }))
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    for (const file of Array.from(files)) {
      const { error } = await uploadDocument(file);
      if (error) {
        setUploadError(`Failed to upload "${file.name}": ${error}`);
        break;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  }

  async function handlePreview(doc: DocumentFile) {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setLoadingPreview(true);
    const { url } = await getDocumentUrl(doc.id);
    setPreviewUrl(url);
    setLoadingPreview(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteDocument(deleteTarget.id);
    setDeleting(false);
    setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function handleLink() {
    if (!linkTarget) return;
    setLinking(true);
    const contactId = selectedContact === "__none" ? null : selectedContact;
    const { data } = await linkDocumentToContact(linkTarget.id, contactId);
    setLinking(false);
    if (data) {
      setDocuments((prev) => prev.map((d) => (d.id === data.id ? data : d)));
    }
    setLinkTarget(null);
    setSelectedContact("__none");
  }

  async function handleCategoryChange(doc: DocumentFile, category: DocumentCategory) {
    const { data } = await updateDocumentCategory(doc.id, category);
    if (data) {
      setDocuments((prev) => prev.map((d) => (d.id === data.id ? data : d)));
    }
  }

  const filtered = documents.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "all" || d.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalSize = documents.reduce((sum, d) => sum + d.file_size, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="max-w-xs h-9"
          />
          <Select
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v as DocumentCategory | "all")}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {documents.length} file{documents.length !== 1 ? "s" : ""} · {formatFileSize(totalSize)}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
            size="sm"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Documents grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <FileText className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold">
            {search || filterCategory !== "all" ? "No results" : "No documents yet"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search || filterCategory !== "all"
              ? "Try adjusting your search or filter."
              : "Upload files to build your document library. You can link them to contacts for easy access."}
          </p>
          {!search && filterCategory === "all" && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 gap-2"
              size="sm"
            >
              <Upload className="h-4 w-4" />
              Upload Files
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {filtered.map((doc) => {
              const Icon = getFileIcon(doc.file_type, doc.name);
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group relative rounded-xl border border-border bg-card p-4 hover:border-amber-500/30 transition-colors"
                >
                  {/* File icon + actions */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50",
                      CATEGORY_COLORS[doc.category]
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Preview"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setLinkTarget(doc);
                          loadContacts();
                          setSelectedContact(doc.contact_id ?? "__none");
                        }}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Link to contact"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* File info */}
                  <h3 className="text-sm font-semibold truncate" title={doc.name}>{doc.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(doc.file_size)}
                  </p>

                  {/* Category badge */}
                  <div className="mt-3 flex items-center justify-between">
                    <Select
                      value={doc.category}
                      onValueChange={(v) => handleCategoryChange(doc, v as DocumentCategory)}
                    >
                      <SelectTrigger className="h-7 w-auto text-[11px] gap-1 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {doc.contact_id && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-400">
                        <Paperclip className="h-2.5 w-2.5" />
                        Linked
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) { setPreviewDoc(null); setPreviewUrl(null); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              {previewDoc?.name}
            </DialogTitle>
            <DialogDescription>
              {previewDoc && `${formatFileSize(previewDoc.file_size)} · ${previewDoc.file_type}`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 min-h-[200px] flex items-center justify-center">
            {loadingPreview ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              previewDoc?.file_type.startsWith("image/") ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.name}
                  className="max-w-full max-h-[60vh] rounded-lg"
                />
              ) : previewDoc?.file_type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh] rounded-lg border border-border"
                  title={previewDoc.name}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <File className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </a>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Failed to load preview</p>
            )}
          </div>
          {previewUrl && (
            <DialogFooter>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Open in new tab
                </Button>
              </a>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Link to contact dialog */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => { if (!o) setLinkTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-indigo-400" />
              Link to Contact
            </DialogTitle>
            <DialogDescription>
              Link &quot;{linkTarget?.name}&quot; to a contact for easy access from their profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact</Label>
              <Select
                value={selectedContact}
                onValueChange={(v) => setSelectedContact(v ?? "__none")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No contact (unlink)</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleLink} disabled={linking} className="gap-2">
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {linking ? "Linking…" : "Link Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot; from your library. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
