"use client";

import { Workflow, Zap, Clock, CheckCircle } from "lucide-react";
import { MetricTile } from "@/components/dashboard/metric-tile";

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automation</h1>
        <p className="text-sm text-muted-foreground">
          Workflows, triggers, and scheduled actions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile title="Active Workflows" value="14" change="+3 this month" icon={Workflow} />
        <MetricTile title="Runs This Week" value="2,410" change="+12% this week" icon={Zap} />
        <MetricTile title="Avg. Runtime" value="1.2s" change="-0.3s this month" icon={Clock} />
        <MetricTile title="Success Rate" value="99.2%" change="+0.4% this month" icon={CheckCircle} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">Workflow Builder</h3>
        <div className="mt-6 flex h-64 items-center justify-center rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">Workflow canvas placeholder</p>
        </div>
      </div>
    </div>
  );
}
