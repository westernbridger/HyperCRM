export const dynamic = "force-dynamic";

import { Target, TrendingUp, Users, Globe } from "lucide-react";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PipelineBoard } from "@/components/leads/pipeline-board";
import { getContacts } from "@/app/actions/contacts";

export default async function LeadsPage() {
  const { data: contacts } = await getContacts();
  const all = contacts ?? [];

  const newLeads    = all.filter((c) => c.status === "Lead").length;
  const prospects   = all.filter((c) => c.status === "Prospect").length;
  const customers   = all.filter((c) => c.status === "Customer").length;
  const metaLeads   = all.filter((c) => c.custom_fields?.meta_form_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag cards between stages to update status. Group by campaign to see Meta Ads performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile title="New Leads"    value={String(newLeads)}  change="in pipeline"           icon={Target} />
        <MetricTile title="Prospects"    value={String(prospects)} change="being nurtured"         icon={Users} />
        <MetricTile title="Customers"    value={String(customers)} change="converted"              icon={TrendingUp} />
        <MetricTile title="From Meta Ads" value={String(metaLeads)} change="via Facebook / Instagram" icon={Globe} />
      </div>

      <PipelineBoard initialContacts={all} />
    </div>
  );
}
