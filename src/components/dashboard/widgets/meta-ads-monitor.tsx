"use client";

import { Globe, Webhook, CheckCircle2, BarChart3, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Meta Ads Campaign Monitor Widget
export function MetaAdsMonitor() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground/60" />
          <span className="text-sm font-medium">Meta Integration</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">Not connected</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Active Forms</p>
          <p className="text-base font-bold">4</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Ad Groups</p>
          <p className="text-base font-bold">12</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-1.5">
          <div className="flex items-center gap-2">
            <Webhook className="h-3.5 w-3.5 text-emerald-400/70" />
            <span className="text-xs">Live Webhook</span>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400/80 text-[10px] px-1 py-0 border-0">
            <span className="mr-1 inline-block h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
            Operational
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs">Lead Sync</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">Active</Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-1.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs">Attribution</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">Tracking</Badge>
        </div>
      </div>

      <div className="pt-1">
        <p className="text-[10px] text-muted-foreground mb-1">Recent Sync Activity</p>
        <div className="flex items-center gap-2 text-xs">
          <RefreshCw className="h-3 w-3 text-emerald-400" />
          <span>Last sync: 2 minutes ago</span>
        </div>
      </div>
    </div>
  );
}
