"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, RefreshCw, Zap, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRecentActivities } from "@/hooks/use-dashboard";
import { ACTIVITY_ICON_MAP } from "@/components/dashboard/config";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

// Live CRM Activity Pulse Widget — live from Supabase via React Query
export function LiveActivityPulse() {
  const router = useRouter();
  const { data: events = [], isLoading } = useRecentActivities();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading activity…</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
        <Activity className="h-8 w-8 opacity-30" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-3 pb-4">
        {events.map((event, i) => {
          const cfg = ACTIVITY_ICON_MAP[event.type] ?? { icon: Zap, color: "text-muted-foreground" };
          const Icon = cfg.icon;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/contacts/${event.contact_id}`)}
              className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted cursor-pointer group"
            >
              <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                  {event.title}
                  {event.contact_name && (
                    <span className="font-normal text-muted-foreground"> — {event.contact_name}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</span>
                  {event.performed_by && (
                    <>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground">by {event.performed_by}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-0.5" />
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
