"use client";

import { MainBoard } from "@/components/dashboard/main-board";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back — here&apos;s what&apos;s happening across your workspace.
        </p>
      </div>

      <MainBoard />
    </div>
  );
}
