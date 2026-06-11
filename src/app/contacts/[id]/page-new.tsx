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
import { ArrowLeft, Mail, Phone, Building2, Calendar, Globe, Pencil, Trash2, MessageSquare, Clock, FileText, PhoneCall, CheckCircle2, Plus, Loader2 } from "lucide-react";

// New unified data layer
import {
  getContactById,
  deleteContact,
  getContactActivities,
  addActivity,
  type UiContact,
} from "@/lib/data/contacts";
import type { Activity } from "@/app/actions/contacts";
import { useToast } from "@/hooks/use-toast";

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

interface ActivityItem {
  id: string;
  type: "note" | "email" | "status_change" | "document" | "meeting" | "call" | "task" | "creation";
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

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [contact, setContact] = useState<UiContact | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [newActivity, setNewActivity] = useState<NewActivityForm>({
    type: "note",
    title: "",
    description: "",
  });

  const contactId = params.id as string;

  // Load contact and activities
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      // Load contact
      const contactData = await getContactById(contactId);
      if (!contactData) {
        toast({
          title: "Contact not found",
          description: "The contact you're looking for doesn't exist.",
          variant: "destructive",
        });
        router.push("/contacts");
        return;
      }
      setContact(contactData);
      
      // Load activities (will transform from DB format to UI format)
      const dbActivities = await getContactActivities(contactId);
      const uiActivities: ActivityItem[] = dbActivities.map((a: any) => ({
        id: a.id,
        type: a.type === "creation" ? "document" : a.type,
        title: a.title,
        description: a.content || "",
        timestamp: a.created_at,
        author: "You",
      }));
      setActivities(uiActivities);
      
      // Load UI preferences from localStorage
      const storedFields = localStorage.getItem("hypercrm_fields");
      const storedStatuses = localStorage.getItem("hypercrm_statuses");
      
      if (storedFields) {
        try {
          setFieldDefinitions(JSON.parse(storedFields));
        } catch {}
      }
      
      if (storedStatuses) {
        try {
          setStatusConfigs(JSON.parse(storedStatuses));
        } catch {}
      }
      
      setLoading(false);
    }
    
    loadData();
  }, [contactId, router, toast]);

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "url": return <Globe className="h-4 w-4" />;
      case "date": return <Calendar className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "note": return <MessageSquare className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "status_change": return <Clock className="h-4 w-4" />;
      case "document":
      case "creation": return <FileText className="h-4 w-4" />;
      case "call": return <PhoneCall className="h-4 w-4" />;
      case "task": return <CheckCircle2 className="h-4 w-4" />;
      case "meeting": return <Calendar className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "note": return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-400/30", dot: "bg-blue-500" };
      case "email": return { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-400/30", dot: "bg-emerald-500" };
      case "status_change": return { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-400/30", dot: "bg-amber-500" };
      case "document":
      case "creation": return { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-400/30", dot: "bg-purple-500" };
      case "call": return { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-400/30", dot: "bg-cyan-500" };
      case "task": return { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-400/30", dot: "bg-pink-500" };
      case "meeting": return { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-400/30", dot: "bg-indigo-500" };
      default: return { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-400/30", dot: "bg-slate-500" };
    }
  };

  const handleBack = () => router.push("/contacts");

  const handleDelete = async () => {
    if (!contact) return;
    
    const success = await deleteContact(contact.id);
    
    if (success) {
      toast({
        title: "Contact deleted",
        description: `${contact.name} has been deleted.`,
      });
      router.push("/contacts");
    } else {
      toast({
        title: "Error deleting contact",
        description: "Failed to delete contact. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveActivity = async () => {
    if (!newActivity.title.trim() || !contact) return;
    
    // Map UI types to DB types
    const dbType: Activity["type"] = 
      newActivity.type === "task" ? "note" : 
      newActivity.type === "creation" ? "document" : 
      newActivity.type;
    
    const success = await addActivity(
      contact.id,
      dbType,
      newActivity.title,
      newActivity.description
    );
    
    if (success) {
      // Add to local state
      const activity: ActivityItem = {
        id: Date.now().toString(),
        type: newActivity.type,
        title: newActivity.title,
        description: newActivity.description,
        timestamp: new Date().toISOString(),
        author: "You",
      };
      setActivities([activity, ...activities]);
      
      toast({
        title: "Activity added",
        description: "The activity has been recorded.",
      });
      
      // Reset form
      setNewActivity({ type: "note", title: "", description: "" });
      setIsAddActivityOpen(false);
    } else {
      toast({
        title: "Error adding activity",
        description: "Failed to save activity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
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

  const getStatusStyle = (statusLabel: string) => {
    const config = statusConfigs.find((s) => s.label === statusLabel);
    if (!config) return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
    
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Contact not found</div>
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
                className="ml-2"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  borderColor: statusStyle.border,
                }}
              >
                {contact.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {}} className="gap-2">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <a href={`mailto:${contact.email}`} className="w-full">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Mail className="h-4 w-4" />
                    Send Email
                  </Button>
                </a>
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="w-full">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Phone className="h-4 w-4" />
                      Call {contact.phone}
                    </Button>
                  </a>
                )}
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setIsAddActivityOpen(true)}>
                  <MessageSquare className="h-4 w-4" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {/* Contact Details */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                  </div>
                </div>
                
                {contact.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                  </div>
                )}
                
                {contact.company && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm text-muted-foreground">{contact.company}</p>
                    </div>
                  </div>
                )}

                <Separator />
                
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">{formatDate(contact.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields */}
            {fieldDefinitions.length > 0 && Object.keys(contact.customFields).length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fieldDefinitions.map((field) => {
                    const value = contact.customFields[field.id];
                    if (!value) return null;
                    
                    return (
                      <div key={field.id} className="flex items-start gap-3">
                        <div className="mt-0.5 text-muted-foreground">
                          {getFieldIcon(field.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{field.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {field.type === "date" 
                              ? formatDate(value as string)
                              : String(value)
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Activity Timeline */}
          <div className="lg:col-span-2">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
                <Button size="sm" onClick={() => setIsAddActivityOpen(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No activity recorded yet</p>
                    <p className="text-sm mt-1 mb-4">Start tracking interactions with this contact</p>
                    <Button variant="outline" onClick={() => setIsAddActivityOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Activity
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity, index) => {
                      const colors = getActivityColor(activity.type);
                      const isLast = index === activities.length - 1;
                      
                      return (
                        <div key={activity.id} className="flex gap-4">
                          {/* Timeline line */}
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border}`}>
                              {getActivityIcon(activity.type)}
                            </div>
                            {!isLast && (
                              <div className="w-px h-full bg-border mt-2" />
                            )}
                          </div>
                          
                          {/* Activity content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{activity.title}</p>
                                {activity.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTimeAgo(activity.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(activity.timestamp)}
                            </p>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
            <DialogDescription>
              Record a new interaction or note for this contact.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Activity Type</Label>
              <Select
                value={newActivity.type}
                onValueChange={(value) => value && setNewActivity({ ...newActivity, type: value as ActivityItem["type"] })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                placeholder="e.g., Follow-up call"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                placeholder="Add details about this activity..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveActivity} disabled={!newActivity.title.trim()}>
              Save Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
