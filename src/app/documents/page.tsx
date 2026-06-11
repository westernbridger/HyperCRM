"use client";

import { FileText, FolderOpen, Clock, Upload } from "lucide-react";
import { MetricTile } from "@/components/dashboard/metric-tile";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Proposals, contracts, and shared files.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile title="Total Docs" value="124" change="+6 this week" icon={FileText} />
        <MetricTile title="Folders" value="18" change="+2 this month" icon={FolderOpen} />
        <MetricTile title="Pending Review" value="5" change="-2 this week" icon={Clock} />
        <MetricTile title="Uploaded" value="12GB" change="+1.2GB this month" icon={Upload} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">Document Library</h3>
        <div className="mt-6 flex h-64 items-center justify-center rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">Document grid placeholder</p>
        </div>
      </div>
    </div>
  );
}
