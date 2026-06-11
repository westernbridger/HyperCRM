"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Target,
  MessageSquare,
  FileText,
  Workflow,
  Shield,
  Menu,
  ChevronDown,
  Zap,
  LogOut,
  Settings,
  User,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "Communications", href: "/communications", icon: MessageSquare },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Automation", href: "/automation", icon: Workflow },
  { label: "Team", href: "/team", icon: Shield },
];

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  workspace_id: string;
}

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        // Get auth user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          setLoading(false);
          return;
        }

        // Get user data from our users table
        const { data: userData, error } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, role, workspace_id")
          .eq("id", authUser.id)
          .single();

        if (error) {
          console.error("Error loading user:", error);
        } else if (userData) {
          setUser(userData as UserData);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "JD";
  };

  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user?.email?.split("@")[0] || "Jane Doe";
  };

  const getRoleDisplay = () => {
    if (!user?.role) return "User";
    return user.role.charAt(0) + user.role.slice(1).toLowerCase();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">HyperCRM</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-secondary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon className={`relative z-10 h-4 w-4 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
              <span className={`relative z-10 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <Separator className="mb-4 bg-sidebar-border" />
        
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary transition-colors">
                <Avatar className="h-8 w-8 border border-white/10">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-emerald-500 text-xs text-white font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {getDisplayName()}
                  </span>
                  <span className="text-xs text-muted-foreground">{getRoleDisplay()}</span>
                </div>
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" side="right">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{getDisplayName()}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-2">Not signed in</p>
            <Link href="/login" className="w-full">
              <Button 
                variant="secondary" 
                className="w-full justify-center"
              >
                Sign In
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden sticky top-0 h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <div className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight">HyperCRM</span>
        </div>
      </div>
    </>
  );
}
