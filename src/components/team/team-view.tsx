"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, User, Crown, UserPlus, Loader2, Mail,
  MoreHorizontal, Trash2, RefreshCw, Clock, CheckCircle2, AlertCircle, Building2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import {
  inviteTeamMember,
  getTeamMembers,
  updateMemberRole,
  removeMember,
  revokeInvitation,
  getInvitations,
  type UserRole,
  type Invitation,
} from "@/app/actions/team";
import { getUserWorkspaces, type Workspace } from "@/app/actions/workspaces";

export type TeamMember = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
  created_at: string
}

const ROLE_CONFIG = {
  MASTER: {
    label: "Master Account",
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    description: "Full platform control. Manages billing, admins, and all settings.",
  },
  ADMIN: {
    label: "Admin",
    icon: Shield,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    description: "Manages contacts, leads, team members, and automations.",
  },
  ASSOCIATE: {
    label: "Associate",
    icon: User,
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
    description: "Can view and edit assigned contacts and leads.",
  },
} as const;

function getInitials(member: TeamMember): string {
  const first = member.first_name?.[0] ?? "";
  const last = member.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || member.email.substring(0, 2).toUpperCase();
}

function getDisplayName(member: TeamMember): string {
  if (member.first_name || member.last_name) {
    return [member.first_name, member.last_name].filter(Boolean).join(" ");
  }
  return member.email.split("@")[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TeamView() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Invite modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "ASSOCIATE">("ASSOCIATE");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);
  const [managedWorkspaces, setManagedWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [inviteResults, setInviteResults] = useState<{ workspace: string; success: boolean; emailSent: boolean; error: string | null }[]>([]);
  const [isPending, startTransition] = useTransition();

  // Per-row action feedback
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadError("Not authenticated"); setLoading(false); return; }

    setMyId(user.id);

    // Get current workspace from metadata (set by WorkspaceSwitcher)
    const currentWorkspaceId = user.user_metadata?.current_workspace_id as string | undefined;
    if (!currentWorkspaceId) { setLoadError("No workspace selected"); setLoading(false); return; }

    // Get my role in the current workspace from the junction table
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", currentWorkspaceId)
      .maybeSingle<{ role: UserRole }>();

    if (!membership) { setLoadError("You are not a member of this workspace"); setLoading(false); return; }
    setMyRole(membership.role);

    // Load members via server action (queries workspace_members junction table)
    const { data: membersData, error: membersError } = await getTeamMembers();
    if (membersError) { setLoadError(membersError); setLoading(false); return; }
    setMembers(membersData);

    // Fetch pending invitations (MASTER/ADMIN only)
    if (membership.role === "MASTER" || membership.role === "ADMIN") {
      const { data: invData } = await getInvitations();
      setInvitations(invData);
    }

    // Load workspaces the user can invite into (MASTER or ADMIN)
    const { data: allWorkspaces } = await getUserWorkspaces();
    const manageable = (allWorkspaces ?? []).filter(
      (w) => w.role === "MASTER" || w.role === "ADMIN"
    );
    setManagedWorkspaces(manageable);
    // Default to current workspace pre-checked
    const defaultId = manageable.find((w) => w.id === currentWorkspaceId)?.id ?? manageable[0]?.id;
    setSelectedWorkspaceIds(defaultId ? [defaultId] : []);

    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function resetInviteForm() {
    setInviteEmail("");
    setInviteRole("ASSOCIATE");
    setInviteError(null);
    setInviteSuccess(false);
    setTempPassword(null);
    setEmailWarning(false);
    setInviteResults([]);
    // Re-default to current workspace
    const currentId = managedWorkspaces[0]?.id ?? "";
    setSelectedWorkspaceIds(currentId ? [currentId] : []);
  }

  function toggleWorkspace(id: string) {
    setSelectedWorkspaceIds((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    if (selectedWorkspaceIds.length === 0) {
      setInviteError("Please select at least one workspace to invite into");
      return;
    }
    setInviteError(null);
    startTransition(async () => {
      const results = await Promise.all(
        selectedWorkspaceIds.map(async (wsId) => {
          const ws = managedWorkspaces.find((w) => w.id === wsId);
          const { emailSent, error } = await inviteTeamMember(
            inviteEmail.trim(),
            inviteRole,
            wsId
          );
          return { workspace: ws?.name ?? wsId, success: !error, emailSent, error: error ?? null };
        })
      );

      const allFailed = results.every((r) => !r.success);
      if (allFailed) {
        setInviteError(results[0]?.error ?? "Failed to send invitations");
        return;
      }

      const anyEmailNotSent = results.some((r) => r.success && !r.emailSent);
      setEmailWarning(anyEmailNotSent);
      setInviteResults(results);
      setInviteSuccess(true);
      await loadAll();
    });
  }

  function handleRoleChange(memberId: string, newRole: UserRole) {
    setActionError(null);
    startTransition(async () => {
      const { error } = await updateMemberRole(memberId, newRole);
      if (error) setActionError(error);
      else await loadAll();
    });
  }

  function handleRemove(memberId: string) {
    setActionError(null);
    startTransition(async () => {
      const { error } = await removeMember(memberId);
      if (error) setActionError(error);
      else await loadAll();
    });
  }

  function handleRevoke(invitationId: string) {
    setActionError(null);
    startTransition(async () => {
      const { error } = await revokeInvitation(invitationId);
      if (error) setActionError(error);
      else await loadAll();
    });
  }

  const canManage = myRole === "MASTER" || myRole === "ADMIN";
  const roleKeys = ["MASTER", "ADMIN", "ASSOCIATE"] as const;

  return (
    <div className="space-y-8">
      {/* Role tier cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {roleKeys.map((role) => {
          const cfg = ROLE_CONFIG[role];
          const count = members.filter((m) => m.role === role).length;
          return (
            <motion.div
              key={role}
              whileHover={{ y: -4 }}
              className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${cfg.bg}`}
            >
              <div className="flex items-center gap-2">
                <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
                <h3 className="font-semibold">{cfg.label}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{cfg.description}</p>
              <div className="mt-4">
                <span className="text-2xl font-bold">
                  {loading ? <span className="inline-block h-7 w-6 animate-pulse rounded bg-muted" /> : count}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">{count === 1 ? "member" : "members"}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Global action error */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
            <button className="ml-auto text-xs underline" onClick={() => setActionError(null)}>Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main table with tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-semibold">Workspace Members</h3>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {members.length} {members.length === 1 ? "member" : "members"}
                {invitations.length > 0 && ` · ${invitations.length} pending invite${invitations.length > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
          {canManage && (
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow"
              onClick={() => { resetInviteForm(); setIsInviteOpen(true); }}
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center py-16 text-sm text-destructive">{loadError}</div>
        ) : (
          <Tabs defaultValue="members">
            <div className="border-b border-border px-5">
              <TabsList className="h-10 bg-transparent gap-4 p-0 rounded-none">
                <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2.5 px-0 text-sm">
                  Members
                </TabsTrigger>
                {canManage && (
                  <TabsTrigger value="invitations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2.5 px-0 text-sm gap-2">
                    Pending Invites
                    {invitations.length > 0 && (
                      <span className="rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] px-1.5 py-0.5 font-medium">
                        {invitations.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ── Members Tab ── */}
            <TabsContent value="members" className="m-0">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <User className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No members found.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {members.map((member, index) => {
                    const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.ASSOCIATE;
                    const isMe = member.id === myId;
                    const canEditThis = myRole === "MASTER" && !isMe;
                    const canRemoveThis = canManage && !isMe && member.role !== "MASTER";

                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                      >
                        <Avatar className="h-9 w-9 border border-border shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500/60 to-purple-500/60 text-xs font-semibold text-white">
                            {getInitials(member)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{getDisplayName(member)}</p>
                            {isMe && <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">You</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>

                        <div className="hidden md:flex items-center text-xs text-muted-foreground shrink-0">
                          Joined {formatDate(member.created_at)}
                        </div>

                        {/* Role badge / selector */}
                        {canEditThis ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleRoleChange(member.id, v as UserRole)}
                            disabled={isPending}
                          >
                            <SelectTrigger className={`w-36 h-7 text-xs border gap-1 ${cfg.bg} ${cfg.color}`}>
                              <cfg.icon className="h-3 w-3 shrink-0" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="ASSOCIATE">Associate</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={`shrink-0 gap-1 ${cfg.bg} ${cfg.color}`}>
                            <cfg.icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        )}

                        {/* Actions dropdown */}
                        {canRemoveThis && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive gap-2"
                                onClick={() => handleRemove(member.id)}
                                disabled={isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove from workspace
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Pending Invitations Tab ── */}
            {canManage && (
              <TabsContent value="invitations" className="m-0">
                {invitations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No pending invitations.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {invitations.map((inv, index) => {
                      const cfg = ROLE_CONFIG[inv.role] ?? ROLE_CONFIG.ASSOCIATE;
                      const expiresIn = Math.ceil(
                        (new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="h-9 w-9 rounded-full border border-border bg-muted flex items-center justify-center shrink-0">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{inv.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Invited by {inv.invited_by_name ?? "Unknown"}
                            </p>
                          </div>

                          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            Expires in {expiresIn}d
                          </div>

                          <Badge variant="outline" className={`shrink-0 gap-1 ${cfg.bg} ${cfg.color}`}>
                            <cfg.icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRevoke(inv.id)}
                            disabled={isPending}
                            title="Revoke invitation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>

      {/* ── Invite Member Dialog ── */}
      <Dialog open={isInviteOpen} onOpenChange={(o) => { setIsInviteOpen(o); if (!o) resetInviteForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-400" />
              Invite a Team Member
            </DialogTitle>
            <DialogDescription>
              New users receive a link to set their password. Existing users get an "Accept" link. Invites expire in 7 days.
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {inviteSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-4 text-center"
              >
                <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="space-y-1 w-full">
                  <p className="font-semibold">Invitation{inviteResults.length > 1 ? "s" : ""} sent!</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{inviteEmail}</span> has been invited to:
                  </p>
                  <div className="mt-2 space-y-1 text-left">
                    {inviteResults.map((r) => (
                      <div key={r.workspace} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${
                        r.success ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                      }`}>
                        {r.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                        <span className="font-medium">{r.workspace}</span>
                        {r.error && <span className="text-[10px] opacity-70 ml-auto">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {emailWarning && (
                  <div className="w-full flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-500">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Some emails could not be delivered (check RESEND_API_KEY / RESEND_FROM_EMAIL).
                      Invitations were still created — the invitee can accept from their workspace switcher.
                    </span>
                  </div>
                )}

                <div className="flex gap-2 w-full pt-2">
                  <Button variant="secondary" className="flex-1" onClick={() => resetInviteForm()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Invite another
                  </Button>
                  <Button className="flex-1" onClick={() => setIsInviteOpen(false)}>Done</Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Workspace{selectedWorkspaceIds.length > 1 ? "s" : ""}</Label>
                  {managedWorkspaces.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      You must be a MASTER or ADMIN of a workspace to invite members.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-border divide-y divide-border max-h-36 overflow-y-auto">
                      {managedWorkspaces.map((ws) => (
                        <label
                          key={ws.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedWorkspaceIds.includes(ws.id) ? "bg-indigo-500/5" : ""
                          }`}
                        >
                          <Checkbox
                            id={`ws-${ws.id}`}
                            checked={selectedWorkspaceIds.includes(ws.id)}
                            onCheckedChange={() => toggleWorkspace(ws.id)}
                            disabled={isPending}
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate">{ws.name}</span>
                            <span className={`ml-auto text-[10px] font-medium shrink-0 ${
                              ws.role === "MASTER" ? "text-amber-500" : "text-blue-500"
                            }`}>{ws.role}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedWorkspaceIds.length === 0 && managedWorkspaces.length > 0 && (
                    <p className="text-[11px] text-amber-500">Select at least one workspace.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["ADMIN", "ASSOCIATE"] as const).map((r) => {
                      const cfg = ROLE_CONFIG[r];
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInviteRole(r)}
                          className={`rounded-lg border p-3 text-left transition-all ${
                            inviteRole === r
                              ? `${cfg.bg} ring-2 ring-offset-1 ring-offset-card ring-indigo-500/50`
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                            <span className="text-sm font-medium">{cfg.label}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">{cfg.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {inviteError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {inviteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="secondary" onClick={() => setIsInviteOpen(false)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={isPending || !inviteEmail.trim()}
                    className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                  >
                    {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Mail className="h-4 w-4" /> Send Invite</>}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
