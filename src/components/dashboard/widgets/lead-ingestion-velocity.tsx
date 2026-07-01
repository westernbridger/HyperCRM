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
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 min-h-0 w-full">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={leadData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="leads" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
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
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
          Last 7 days
        </Badge>
      </div>
    </div>
  );
}
