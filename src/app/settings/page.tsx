"use client";

import { Mail, PenLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailDomainsPanel } from "@/components/settings/email-domains-panel";
import { SignatureEditor } from "@/components/settings/signature-editor";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace configuration.
        </p>
      </div>

      <Tabs defaultValue="domains" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="domains" className="gap-2">
            <Mail className="h-4 w-4" />
            Sending Domains
          </TabsTrigger>
          <TabsTrigger value="signature" className="gap-2">
            <PenLine className="h-4 w-4" />
            Signature
          </TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="mt-6">
          <EmailDomainsPanel />
        </TabsContent>

        <TabsContent value="signature" className="mt-6">
          <SignatureEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
