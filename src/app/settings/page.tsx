"use client";

import { Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailDomainsPanel } from "@/components/settings/email-domains-panel";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace configuration.
        </p>
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6">
          <EmailDomainsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
