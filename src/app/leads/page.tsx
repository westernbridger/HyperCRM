"use client";

import { useState, useEffect } from "react";
import { Target, TrendingUp, Users, Globe, Loader2 } from "lucide-react";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PipelineBoard } from "@/components/leads/pipeline-board";
import { getContacts, type Contact } from "@/app/actions/contacts";

export default function LeadsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getContacts().then(({ data }) => {
      setContacts(data ?? []);
      setLoading(false);
    });
  }, []);

  const newLeads  = contacts.filter((c) => c.status === "Lead").length;
  const prospects = contacts.filter((c) => c.status === "Prospect").length;
  const customers = contacts.filter((c) => c.status === "Customer").length;
  const metaLeads = contacts.filter((c) => c.custom_fields?.meta_form_id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading pipeline…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag cards between stages to update status. Group by campaign to see Meta Ads performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile title="New Leads"     value={String(newLeads)}  change="in pipeline"              icon={Target} />
        <MetricTile title="Prospects"     value={String(prospects)} change="being nurtured"            icon={Users} />
        <MetricTile title="Customers"     value={String(customers)} change="converted"                 icon={TrendingUp} />
        <MetricTile title="From Meta Ads" value={String(metaLeads)} change="via Facebook / Instagram"  icon={Globe} />
      </div>

      <PipelineBoard initialContacts={contacts} />
    </div>
  );
}
