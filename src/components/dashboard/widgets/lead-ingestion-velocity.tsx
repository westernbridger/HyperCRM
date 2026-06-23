"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { useLeadsByDay } from "@/hooks/use-dashboard";

// Lead Ingestion Velocity Widget — live from Supabase via React Query
export function LeadIngestionVelocity() {
  // Recharts' ResponsiveContainer needs the client to be mounted before it can
  // measure; guard against SSR hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: leadData = [] } = useLeadsByDay();
  const totalThisWeek = leadData.reduce((sum, d) => sum + d.leads, 0);
  const hasData = leadData.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[160px] w-full min-h-[160px]">
        {mounted && (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={leadData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              />
              <Area type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center justify-between pt-2">
        <div>
          {!hasData ? (
            <div className="h-8 w-10 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold">{totalThisWeek}</p>
          )}
          <p className="text-xs text-muted-foreground">New contacts this week</p>
        </div>
        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
          Last 7 days
        </Badge>
      </div>
    </div>
  );
}
