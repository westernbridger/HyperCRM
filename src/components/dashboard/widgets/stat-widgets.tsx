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
          <p className="text-2xl font-bold">{total.toLocaleString()}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">Total contacts</p>
      </div>
      <Users className="h-7 w-7 text-muted-foreground/30" />
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
          <p className="text-2xl font-bold">{rate}%</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">Leads → Customers</p>
      </div>
      <Activity className="h-7 w-7 text-muted-foreground/30" />
    </div>
  );
}
