"use client";

import { MessageSquare, Mail, Phone, Send } from "lucide-react";
import { MetricTile } from "@/components/dashboard/metric-tile";

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
        <p className="text-sm text-muted-foreground">
          Email, SMS, and call logs in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile title="Emails Sent" value="8,240" change="+18% this month" icon={Mail} />
        <MetricTile title="SMS Sent" value="4,165" change="+32% this month" icon={Send} />
        <MetricTile title="Calls Made" value="312" change="+8% this week" icon={Phone} />
        <MetricTile title="Open Rate" value="42.6%" change="+3.1% this month" icon={MessageSquare} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">Recent Conversations</h3>
        <div className="mt-6 flex h-64 items-center justify-center rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">Conversation list placeholder</p>
        </div>
      </div>
    </div>
  );
}
