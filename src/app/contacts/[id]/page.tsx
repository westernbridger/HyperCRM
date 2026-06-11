"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, Building2, Calendar, Globe, Pencil, Trash2, MessageSquare, Clock, FileText, PhoneCall, CheckCircle2, Plus, X, Loader2, Save } from "lucide-react";
import {
  getContactById,
  getContactActivities,
  deleteContact,
  addActivity,
  updateContact,
} from "@/lib/data/contacts";

const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

interface FieldDefinition {
  id: string;
  name: string;
  type: "text" | "number" | "email" | "url" | "date" | "select" | "textarea";
  required: boolean;
  options?: string[];
}

interface StatusConfig {
  id: string;
  label: string;
  color: string;
}

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

interface ActivityItem {
  id: string;
  type: "note" | "email" | "status_change" | "document" | "meeting" | "call" | "task";
  title: string;
  description?: string;
  timestamp: string;
  author?: string;
}

interface NewActivityForm {
  type: ActivityItem["type"];
  title: string;
  description: string;
}

interface EditContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: "Lead" | "Prospect" | "Customer" | "Churned";
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditContactForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    status: "Lead",
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Add activity modal state
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [newActivity, setNewActivity] = useState<NewActivityForm>({
    type: "note",
    title: "",
    description: "",
  });

  useEffect(() => {
    setMounted(true);

    // Load field/status configs from localStorage (UI-only settings)
    const storedFields = localStorage.getItem("hypercrm_fields");
    const storedStatuses = localStorage.getItem("hypercrm_statuses");
    if (storedFields) setFieldDefinitions(JSON.parse(storedFields));
    if (storedStatuses) setStatusConfigs(JSON.parse(storedStatuses));

    async function loadData() {
      setIsPageLoading(true);
      try {
        const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
        if (!id) { router.push("/contacts"); return; }

        // Load contact from unified layer (Supabase or localStorage)
        const found = await getContactById(id);
        if (!found) {
          router.push("/contacts");
          return;
        }
        setContact(found as unknown as Contact);

        // Load activities from unified layer
        const acts = await getContactActivities(id);
        const mapped: ActivityItem[] = acts.map((a) => ({
          id: a.id,
          type: a.type as ActivityItem["type"],
          title: a.title,
          description: a.content ?? undefined,
          timestamp: a.created_at,
          author: "You",
        }));
        setActivities(mapped);
      } catch (err) {
        console.error("Error loading contact:", err);
        router.push("/contacts");
      } finally {
        setIsPageLoading(false);
      }
    }

    loadData();
  }, [params.id, router]);

  const getStatusStyle = (statusLabel: string) => {
    const status = statusConfigs.find((s) => s.label === statusLabel);
    if (!status) {
      return { bg: "rgba(100, 116, 139, 0.2)", text: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" };
    }
    return {
      bg: `${status.color}25`,
      text: status.color,
      border: `${status.color}40`,
    };
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "url":
        return <Globe className="h-4 w-4" />;
      case "date":
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "note":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "status_change":
        return <Clock className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      case "call":
        return <PhoneCall className="h-4 w-4" />;
      case "task":
        return <CheckCircle2 className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "note":
        return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-400/30", dot: "bg-blue-500" };
      case "email":
        return { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-400/30", dot: "bg-emerald-500" };
      case "status_change":
        return { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-400/30", dot: "bg-amber-500" };
      case "document":
        return { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-400/30", dot: "bg-purple-500" };
      case "call":
        return { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-400/30", dot: "bg-cyan-500" };
      case "task":
        return { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-400/30", dot: "bg-pink-500" };
      case "meeting":
        return { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-400/30", dot: "bg-indigo-500" };
      default:
        return { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-400/30", dot: "bg-slate-500" };
    }
  };

  const handleBack = () => {
    router.push("/contacts");
  };

  const handleEdit = () => {
    if (!contact) return;
    const [firstName, ...rest] = contact.name.split(" ");
    setEditForm({
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      status: (contact.status as EditContactForm["status"]) ?? "Lead",
    });
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!contact) return;
    setIsSaving(true);
    setEditError(null);
    try {
      const fullName = [editForm.firstName, editForm.lastName].filter(Boolean).join(" ");
      const updated = await updateContact(contact.id, {
        name: fullName,
        email: editForm.email,
        phone: editForm.phone,
        company: editForm.company,
        status: editForm.status,
      });
      if (!updated) {
        setEditError("Failed to save changes. Please try again.");
        return;
      }
      setContact(updated as unknown as Contact);
      setIsEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    await deleteContact(contact.id);
    router.push("/contacts");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  const handleAddActivity = () => {
    setIsAddActivityOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!newActivity.title.trim() || !contact) return;

    // Optimistic update
    const optimistic: ActivityItem = {
      id: generateUUID(),
      type: newActivity.type,
      title: newActivity.title,
      description: newActivity.description,
      timestamp: new Date().toISOString(),
      author: "You",
    };
    setActivities((prev) => [optimistic, ...prev]);
    setNewActivity({ type: "note", title: "", description: "" });
    setIsAddActivityOpen(false);

    // Persist via unified layer
    await addActivity(contact.id, newActivity.type as Parameters<typeof addActivity>[1], newActivity.title, newActivity.description || undefined);
  };

  const getActivityTypeLabel = (type: string) => {
    return type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (!mounted || isPageLoading || !contact) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading contact...
        </div>
      </div>
    );
  }

  const statusStyle = getStatusStyle(contact.status);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack} className="hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">{contact.name}</h1>
                <p className="text-sm text-muted-foreground">{contact.company}</p>
              </div>
              <Badge
                variant="outline"
                className="ml-4"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  borderColor: statusStyle.border,
                }}
              >
                {contact.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Info */}
          <div className="space-y-6">
            {/* Quick Contact Card */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contact.email}`} className="text-sm hover:text-primary transition-colors">
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${contact.phone}`} className="text-sm hover:text-primary transition-colors">
                    {contact.phone || "No phone"}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.company || "No company"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Last contact: {contact.lastContact}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields Card */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Custom Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fieldDefinitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom fields configured</p>
                ) : (
                  fieldDefinitions.map((field) => {
                    const value = contact.customFields[field.id];
                    if (!value && value !== 0) return null;
                    
                    return (
                      <div key={field.id} className="flex items-start gap-3">
                        <div className="text-muted-foreground mt-0.5">
                          {getFieldIcon(field.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">{field.name}</p>
                          <p className="text-sm font-medium">
                            {field.type === "url" ? (
                              <a href={String(value)} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors text-blue-400">
                                {String(value)}
                              </a>
                            ) : field.type === "number" ? (
                              typeof value === "number" ? value.toLocaleString() : value
                            ) : (
                              String(value)
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                {Object.keys(contact.customFields).length === 0 && (
                  <p className="text-sm text-muted-foreground">No custom field data</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => window.location.href = `mailto:${contact.email}`}
                >
                  <Mail className="h-4 w-4" />
                  Send Email
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={handleAddActivity}>
                  <MessageSquare className="h-4 w-4" />
                  Add Note
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Follow-up
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity Timeline */}
          <div className="lg:col-span-2">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
                <Button size="sm" onClick={handleAddActivity} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No activity recorded yet</p>
                    <p className="text-sm mt-1 mb-4">Start tracking interactions with this contact</p>
                    <Button variant="outline" onClick={handleAddActivity}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Activity
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {activities.map((activity, index) => {
                      const colors = getActivityColor(activity.type);
                      return (
                        <div key={activity.id} className="relative pl-10 pb-8 last:pb-0 group">
                          {/* Timeline line */}
                          {index < activities.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-border via-border to-transparent" />
                          )}
                          
                          {/* Timeline dot with color coding */}
                          <div className={`absolute left-0 top-0 w-10 h-10 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                            <span className={colors.text}>
                              {getActivityIcon(activity.type)}
                            </span>
                          </div>
                          
                          {/* Content card */}
                          <div className="bg-muted/30 rounded-lg p-4 ml-2 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                                    {getActivityTypeLabel(activity.type)}
                                  </span>
                                  <span className="font-medium text-sm">{activity.title}</span>
                                </div>
                                {activity.description && (
                                  <p className="text-sm text-muted-foreground leading-relaxed">{activity.description}</p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatTimeAgo(activity.timestamp)}</span>
                                  {activity.author && (
                                    <>
                                      <span>•</span>
                                      <span>by {activity.author}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Activity Dialog */}
      <Dialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
            <DialogDescription>
              Record a new interaction with {contact.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Activity Type</Label>
              <Select
                value={newActivity.type}
                onValueChange={(value) => setNewActivity({ ...newActivity, type: value as ActivityItem["type"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="status_change">Status Change</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Enter activity title"
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Add details about this activity..."
                value={newActivity.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewActivity({ ...newActivity, description: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddActivityOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveActivity} disabled={!newActivity.title.trim()}>
              Save Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the core details for {contact?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first-name">First Name</Label>
                <Input
                  id="edit-first-name"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last-name">Last Name</Label>
                <Input
                  id="edit-last-name"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+1 555-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                placeholder="Company name"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v as EditContactForm["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="Churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !editForm.firstName.trim() || !editForm.email.trim()}
              className="gap-2"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
