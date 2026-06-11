"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
  Crown,
  User,
  UserCog,
  Loader2,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getUserWorkspaces,
  switchWorkspace,
  createWorkspace,
  type Workspace,
} from "@/app/actions/workspaces";
import { getPendingInvitationsForUser, type Invitation } from "@/app/actions/team";

const roleIcons = {
  MASTER: Crown,
  ADMIN: UserCog,
  ASSOCIATE: User,
};

const roleColors = {
  MASTER: "text-amber-500",
  ADMIN: "text-blue-500",
  ASSOCIATE: "text-slate-500",
};

export function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    const supabase = createClient();
    
    // Check auth state first
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadWorkspaces();
      } else {
        // Not authenticated, don't try to load workspaces
        setLoading(false);
      }
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadWorkspaces();
      } else if (event === 'SIGNED_OUT') {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setLoading(false);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  async function loadWorkspaces() {
    const [{ data, error }, { data: invitations }] = await Promise.all([
      getUserWorkspaces(),
      getPendingInvitationsForUser(),
    ]);
    
    if (error) {
      // Only log error if it's not an auth error (user might be loading)
      if (error !== 'Not authenticated') {
        console.error("Failed to load workspaces:", error);
      }
      setLoading(false);
      return;
    }

    setWorkspaces(data);
    setPendingInvitations(invitations);
    
    // Get current workspace from user metadata
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const currentId = user?.user_metadata?.current_workspace_id;
    setCurrentWorkspace(data.find(w => w.id === currentId) || data[0] || null);
    setLoading(false);
  }

  async function handleSwitch(workspaceId: string) {
    if (workspaceId === currentWorkspace?.id) return;
    
    setSwitching(workspaceId);
    const { error } = await switchWorkspace(workspaceId);
    
    if (error) {
      console.error("Failed to switch workspace:", error);
      setSwitching(null);
      return;
    }

    // Hard reload to refresh all data with new workspace context
    window.location.href = "/";
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreating(true);
    setError(null);

    const { workspace, error } = await createWorkspace(newWorkspaceName.trim());

    if (error) {
      setError(error);
      setCreating(false);
      return;
    }

    setShowCreateDialog(false);
    setNewWorkspaceName("");
    
    // Hard reload to the new workspace
    window.location.href = "/";
  }

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden md:inline">Loading...</span>
      </Button>
    );
  }

  if (workspaces.length === 0) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setShowCreateDialog(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        <span>Create Workspace</span>
      </Button>
    );
  }

  const RoleIcon = currentWorkspace ? roleIcons[currentWorkspace.role] : Building2;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="relative inline-flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground md:px-3">
          <RoleIcon className={`h-4 w-4 ${currentWorkspace ? roleColors[currentWorkspace.role] : ""}`} />
          <span className="hidden md:inline max-w-[150px] truncate">
            {currentWorkspace?.name || "Select Workspace"}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
          {pendingInvitations.length > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {pendingInvitations.length}
            </span>
          )}
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="start" className="w-64">
          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-amber-500">Pending Invitations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pendingInvitations.map((invitation) => (
                  <DropdownMenuItem
                    key={invitation.id}
                    onClick={() => router.push(`/invite/${invitation.token}`)}
                    className="flex flex-col items-start gap-1 cursor-pointer py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">Invited to join</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      by {invitation.invited_by_name || 'someone'} as {invitation.role}
                    </p>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuGroup>
            <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <AnimatePresence>
              {workspaces.map((workspace) => {
                const Icon = roleIcons[workspace.role];
                const isCurrent = workspace.id === currentWorkspace?.id;
                const isSwitching = switching === workspace.id;
                
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    onClick={() => handleSwitch(workspace.id)}
                    disabled={isSwitching}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {isSwitching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className={`h-4 w-4 ${roleColors[workspace.role]}`} />
                    )}
                    <span className="flex-1 truncate">{workspace.name}</span>
                    {isCurrent && <Check className="h-4 w-4 text-emerald-500" />}
                  </DropdownMenuItem>
                );
              })}
            </AnimatePresence>
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 cursor-pointer text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace. You will be the MASTER owner.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="My Business"
                autoFocus
              />
            </div>
            
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
            
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newWorkspaceName.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
