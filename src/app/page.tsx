"use client";

import { BarChart3, MessageSquare, Globe } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { MainBoard } from "@/components/dashboard/main-board";

// Communications Hub Placeholder
function CommunicationsHub() {
  return (
    <div className="flex h-[500px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/50">
      <div className="text-center">
        <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">Communications Hub</h3>
        <p className="text-sm text-muted-foreground">
          Centralized messaging, email campaigns, and call logs coming soon.
        </p>
      </div>
    </div>
  );
}

// Meta Lead Sync Placeholder
function MetaLeadSync() {
  return (
    <div className="flex h-[500px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/50">
      <div className="text-center">
        <Globe className="mx-auto h-12 w-12 text-blue-500/50" />
        <h3 className="mt-4 text-lg font-semibold">Meta Lead Sync</h3>
        <p className="text-sm text-muted-foreground">
          Advanced Meta Ads integration, lead form management, and attribution analytics.
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, here is what is happening across your workspace.
          </p>
        </div>
      </div>

      <Tabs defaultValue="main" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="main" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Main Board
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Communications Hub
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <Globe className="h-4 w-4" />
            Meta Lead Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-6 [&[data-state='inactive']]:hidden" forceMount>
          <MainBoard />
        </TabsContent>

        <TabsContent value="communications" className="mt-6 [&[data-state='inactive']]:hidden" forceMount>
          <CommunicationsHub />
        </TabsContent>

        <TabsContent value="meta" className="mt-6 [&[data-state='inactive']]:hidden" forceMount>
          <MetaLeadSync />
        </TabsContent>
      </Tabs>

      {/* Masonry Grid Styles */}
      <style jsx global>{`
        .masonry-grid {
          display: flex;
          margin-left: -1rem; /* gutter size offset */
          width: auto;
        }
        .masonry-grid-column {
          padding-left: 1rem; /* gutter size */
          background-clip: padding-box;
        }
        .masonry-grid-column > div {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
