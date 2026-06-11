// Unified data layer - uses Supabase when authenticated, localStorage when not
import { createClient } from "@/lib/supabase/client";
import {
  getContacts as getContactsAction,
  getContactById as getContactByIdAction,
  createContact as createContactAction,
  updateContact as updateContactAction,
  deleteContact as deleteContactAction,
  bulkDeleteContacts as bulkDeleteContactsAction,
  bulkUpdateStatus as bulkUpdateStatusAction,
  batchImportContacts as batchImportContactsAction,
  getContactActivities as getContactActivitiesAction,
  addActivity as addActivityAction,
  getDashboardStats as getDashboardStatsAction,
  type Contact as DbContact,
  type Activity,
  type CreateContactInput,
} from "@/app/actions/contacts";

// Local storage keys (for fallback)
const LS_CONTACTS = "hypercrm_contacts";
const LS_ACTIVITIES = "hypercrm_activities";

// Check if user is authenticated
async function isAuthenticated(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return !!data.user;
}

// Transform functions
function transformDbToUi(dbContact: DbContact): UiContact {
  return {
    id: dbContact.id,
    internalId: dbContact.id,
    name: `${dbContact.first_name} ${dbContact.last_name}`,
    email: dbContact.email,
    phone: dbContact.phone || "",
    company: dbContact.company || "",
    status: dbContact.status,
    lastContact: formatTimeAgo(dbContact.created_at),
    customFields: dbContact.custom_fields as Record<string, string>,
    createdAt: dbContact.created_at,
    _dbData: dbContact,
  };
}

function transformUiToDbInput(contact: Partial<UiContact>): CreateContactInput {
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

// UI Contact type (matches what the components expect)
export interface UiContact {
  id: string;
  internalId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  lastContact: string;
  customFields: Record<string, string>;
  createdAt: string;
  _dbData?: DbContact;
}

// Generate UUID for localStorage
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ===== GET CONTACTS =====
export async function getContacts(): Promise<UiContact[]> {
  if (await isAuthenticated()) {
    const { data, error } = await getContactsAction();
    if (error || !data) return [];
    return data.map(transformDbToUi);
  }

  // Fallback to localStorage
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem(LS_CONTACTS);
  if (!saved) return [];
  
  try {
    const parsed = JSON.parse(saved);
    return parsed.map((c: any) => ({
      ...c,
      id: c.internalId || c.id,
      _dbData: undefined,
    }));
  } catch {
    return [];
  }
}

// ===== GET SINGLE CONTACT =====
export async function getContactById(id: string): Promise<UiContact | null> {
  if (await isAuthenticated()) {
    const { data, error } = await getContactByIdAction(id);
    if (error || !data) return null;
    return transformDbToUi(data);
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  return contacts.find((c) => c.id === id || c.internalId === id) || null;
}

// ===== CREATE CONTACT =====
export async function createContact(contact: Partial<UiContact>): Promise<UiContact | null> {
  if (await isAuthenticated()) {
    const { data, error } = await createContactAction(transformUiToDbInput(contact));
    if (error || !data) return null;
    return transformDbToUi(data);
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  const newContact: UiContact = {
    id: generateUUID(),
    internalId: generateUUID(),
    name: contact.name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    company: contact.company || "",
    status: contact.status || "Lead",
    lastContact: "Just now",
    customFields: contact.customFields || {},
    createdAt: new Date().toISOString(),
  };

  // Save initial activity
  localStorage.setItem(
    `${LS_ACTIVITIES}_${newContact.id}`,
    JSON.stringify([{
      id: generateUUID(),
      type: "creation",
      title: "Contact created",
      description: `Contact profile created for ${newContact.name}`,
      timestamp: new Date().toISOString(),
      author: "You",
    }])
  );

  const updated = [newContact, ...contacts];
  localStorage.setItem(LS_CONTACTS, JSON.stringify(updated));
  return newContact;
}

// ===== UPDATE CONTACT =====
export async function updateContact(
  id: string,
  contact: Partial<UiContact>
): Promise<UiContact | null> {
  const existing = await getContactById(id);
  if (!existing) return null;

  if (await isAuthenticated()) {
    const { data, error } = await updateContactAction(
      id,
      transformUiToDbInput(contact),
      existing._dbData?.status
    );
    if (error || !data) return null;
    return transformDbToUi(data);
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  const updated = contacts.map((c) => {
    if (c.id === id || c.internalId === id) {
      return {
        ...c,
        name: contact.name || c.name,
        email: contact.email || c.email,
        phone: contact.phone ?? c.phone,
        company: contact.company ?? c.company,
        status: contact.status || c.status,
        customFields: { ...c.customFields, ...contact.customFields },
      };
    }
    return c;
  });

  localStorage.setItem(LS_CONTACTS, JSON.stringify(updated));
  return updated.find((c) => c.id === id || c.internalId === id) || null;
}

// ===== DELETE CONTACT =====
export async function deleteContact(id: string): Promise<boolean> {
  if (await isAuthenticated()) {
    const { success } = await deleteContactAction(id);
    return success;
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  const updated = contacts.filter((c) => c.id !== id && c.internalId !== id);
  localStorage.setItem(LS_CONTACTS, JSON.stringify(updated));
  localStorage.removeItem(`${LS_ACTIVITIES}_${id}`);
  return true;
}

// ===== BULK DELETE =====
export async function bulkDeleteContacts(ids: string[]): Promise<boolean> {
  if (await isAuthenticated()) {
    const { success } = await bulkDeleteContactsAction(ids);
    return success;
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  const updated = contacts.filter((c) => !ids.includes(c.id) && !ids.includes(c.internalId));
  localStorage.setItem(LS_CONTACTS, JSON.stringify(updated));
  ids.forEach((id) => localStorage.removeItem(`${LS_ACTIVITIES}_${id}`));
  return true;
}

// ===== BULK UPDATE STATUS =====
export async function bulkUpdateStatus(
  ids: string[],
  status: string
): Promise<boolean> {
  if (await isAuthenticated()) {
    const { success } = await bulkUpdateStatusAction(ids, status as DbContact["status"]);
    return success;
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  const updated = contacts.map((c) => {
    if (ids.includes(c.id) || ids.includes(c.internalId)) {
      return { ...c, status };
    }
    return c;
  });
  localStorage.setItem(LS_CONTACTS, JSON.stringify(updated));
  return true;
}

// ===== BATCH IMPORT =====
export async function batchImportContacts(
  contacts: Partial<UiContact>[]
): Promise<{ success: number; failed: number }> {
  if (await isAuthenticated()) {
    const result = await batchImportContactsAction(contacts.map(transformUiToDbInput));
    return { success: result.inserted, failed: result.failed };
  }

  // Fallback to localStorage
  const existing = await getContacts();
  const newContacts: UiContact[] = contacts.map((c) => ({
    id: generateUUID(),
    internalId: generateUUID(),
    name: c.name || "",
    email: c.email || "",
    phone: c.phone || "",
    company: c.company || "",
    status: c.status || "Lead",
    lastContact: "Just now",
    customFields: c.customFields || {},
    createdAt: new Date().toISOString(),
  }));

  localStorage.setItem(LS_CONTACTS, JSON.stringify([...newContacts, ...existing]));
  return { success: newContacts.length, failed: 0 };
}

// ===== GET ACTIVITIES =====
export async function getContactActivities(contactId: string): Promise<Activity[]> {
  if (await isAuthenticated()) {
    const { data, error } = await getContactActivitiesAction(contactId);
    return data || [];
  }

  // Fallback to localStorage
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem(`${LS_ACTIVITIES}_${contactId}`);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

// ===== ADD ACTIVITY =====
export async function addActivity(
  contactId: string,
  type: Activity["type"],
  title: string,
  content?: string
): Promise<boolean> {
  if (await isAuthenticated()) {
    const { error } = await addActivityAction(contactId, type, title, content);
    return !error;
  }

  // Fallback to localStorage
  const existing = await getContactActivities(contactId);
  const newActivity: any = {
    id: generateUUID(),
    type,
    title,
    description: content || "",
    timestamp: new Date().toISOString(),
    author: "You",
  };
  localStorage.setItem(
    `${LS_ACTIVITIES}_${contactId}`,
    JSON.stringify([newActivity, ...existing])
  );
  return true;
}

// ===== GET LEADS BY DAY (last 7 days) =====
export async function getLeadsByDay(): Promise<{ day: string; leads: number }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const days: { day: string; leads: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      leads: 0,
    });
  }

  if (!user) return days;

  // Get current workspace from user metadata
  const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
  if (!workspaceId) return days;

  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("contacts")
    .select("created_at, status")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (!data) return days;

  data.forEach((row) => {
    const label = new Date(row.created_at).toLocaleDateString("en-US", { weekday: "short" });
    const slot = days.find((d) => d.day === label);
    if (slot) slot.leads++;
  });

  return days;
}

// ===== GET RECENT ACTIVITIES (last 10 across workspace) =====
export interface RecentActivity {
  id: string;
  type: string;
  title: string;
  content: string | null;
  created_at: string;
  contact_id: string;
  contact_name: string | null;
  performed_by: string | null;
}

export async function getRecentActivities(): Promise<RecentActivity[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get current workspace from user metadata
  const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
  if (!workspaceId) return [];

  const { data } = await supabase
    .from("activities")
    .select("id, type, title, content, created_at, contact_id, created_by")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data) return [];

  // Batch-fetch contact names and performer names
  const contactIds = [...new Set(data.map((a) => a.contact_id))];
  const creatorIds = [...new Set(data.map((a) => a.created_by).filter(Boolean))] as string[];

  const [{ data: contacts }, { data: creators }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name").eq("workspace_id", workspaceId).in("id", contactIds),
    creatorIds.length > 0
      ? supabase.from("users").select("id, first_name, last_name, email").in("id", creatorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const contactNameMap = new Map(
    (contacts ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()])
  );
  const creatorNameMap = new Map(
    (creators ?? []).map((u) => [
      u.id,
      (u.first_name || u.last_name)
        ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
        : u.email?.split("@")[0] ?? "Unknown",
    ])
  );

  return data.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    content: a.content,
    created_at: a.created_at,
    contact_id: a.contact_id,
    contact_name: contactNameMap.get(a.contact_id) ?? null,
    performed_by: a.created_by ? (creatorNameMap.get(a.created_by) ?? null) : null,
  }));
}

// ===== GET DASHBOARD STATS =====
export async function getDashboardStats(): Promise<{
  totalContacts: number;
  leadsCount: number;
  customersCount: number;
  recentContacts: UiContact[];
}> {
  if (await isAuthenticated()) {
    const stats = await getDashboardStatsAction();
    return {
      totalContacts: stats.totalContacts,
      leadsCount: stats.leadsCount,
      customersCount: stats.customersCount,
      recentContacts: stats.recentContacts.map(transformDbToUi),
    };
  }

  // Fallback to localStorage
  const contacts = await getContacts();
  return {
    totalContacts: contacts.length,
    leadsCount: contacts.filter((c) => c.status === "Lead").length,
    customersCount: contacts.filter((c) => c.status === "Customer").length,
    recentContacts: contacts.slice(0, 5),
  };
}
