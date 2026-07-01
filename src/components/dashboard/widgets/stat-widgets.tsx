"use client";

import { Users, Activity } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard";

// Total Contacts Widget — live from Supabase via React Query
export function TotalContactsWidget() {
  const { data: stats } = useDashboardStats();
  const total = stats?.totalContacts ?? null;

  return (
    <div className="flex items-center justify-between h-full">
      <div>
        {total === null ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{total.toLocaleString()}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">Total contacts</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40">
        <Users className="h-5 w-5 text-muted-foreground/50" />
      </div>
    </div>
  );
}

// Conversion Rate Widget — leads → customers ratio from Supabase
export function ConversionRateWidget() {
  const { data: stats } = useDashboardStats();
  const rate =
    stats === undefined
      ? null
      : stats.totalContacts > 0
        ? ((stats.customersCount / stats.totalContacts) * 100).toFixed(1)
        : "0.0";

  return (
    <div className="flex items-center justify-between h-full">
      <div>
        {rate === null ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{rate}%</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">Leads → Customers</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40">
        <Activity className="h-5 w-5 text-muted-foreground/50" />
      </div>
    </div>
  );
}
