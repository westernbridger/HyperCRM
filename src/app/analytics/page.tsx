"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Mail,
  Workflow,
  Activity,
  TrendingUp,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Zap,
} from "lucide-react";
import { getAnalytics, type AnalyticsData } from "@/app/actions/analytics";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Lead: "#6366f1",
  Prospect: "#f59e0b",
  Customer: "#10b981",
  Churned: "#ef4444",
};

const ACTIVITY_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#f43f5e",
  "#84cc16",
];

function formatRelativeTime(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: result, error: err } = await getAnalytics();
    if (err) setError(err);
    else setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p className="text-sm text-muted-foreground">
          {error ?? "No analytics data available"}
        </p>
        <button
          onClick={load}
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance insights for your workspace
          </p>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Contacts"
          value={data.totalContacts.toLocaleString()}
          subtext={`+${data.newContacts30d} in last 30 days`}
          color="indigo"
        />
        <StatCard
          icon={MessageSquare}
          label="Conversations"
          value={data.totalConversations.toLocaleString()}
          subtext="All time"
          color="amber"
        />
        <StatCard
          icon={Send}
          label="Emails Sent"
          value={data.emailPerformance.total_sent.toLocaleString()}
          subtext={`${data.emailPerformance.delivery_rate}% delivery rate`}
          color="emerald"
        />
        <StatCard
          icon={Workflow}
          label="Active Workflows"
          value={data.automationMetrics.active_workflows.toString()}
          subtext={`${data.automationMetrics.total_runs} total runs`}
          color="purple"
        />
      </div>

      {/* Contact Growth Chart */}
      <ChartCard title="Contact Growth" subtitle="Last 30 days — cumulative contacts and daily new contacts">
        {mounted && (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.contactGrowth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fill: "#888", fontSize: 11 }}
                interval={4}
              />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => formatChartDate(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Contacts"
                stroke="#6366f1"
                fill="url(#colorTotal)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="new_contacts"
                name="New / Day"
                stroke="#f59e0b"
                fill="url(#colorNew)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Two-column row: Status Distribution + Email Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <ChartCard title="Contact Status Distribution" subtitle="Current pipeline breakdown">
          {mounted && (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={data.statusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.statusDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[entry.status] ?? "#888"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {data.statusDistribution.map((s) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s.status] ?? "#888" }}
                      />
                      <span className="text-sm text-muted-foreground">{s.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{s.count}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">({s.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Email Performance */}
        <ChartCard title="Email Performance" subtitle="Outbound email delivery stats">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <EmailStat
                icon={CheckCircle}
                label="Sent"
                value={data.emailPerformance.total_sent}
                color="text-emerald-400"
              />
              <EmailStat
                icon={XCircle}
                label="Failed"
                value={data.emailPerformance.total_failed}
                color="text-red-400"
              />
              <EmailStat
                icon={Clock}
                label="Queued"
                value={data.emailPerformance.total_queued}
                color="text-amber-400"
              />
            </div>

            {/* Delivery rate gauge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Delivery Rate</span>
                <span className="font-medium">{data.emailPerformance.delivery_rate}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${data.emailPerformance.delivery_rate}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    data.emailPerformance.delivery_rate >= 90
                      ? "bg-emerald-500"
                      : data.emailPerformance.delivery_rate >= 70
                        ? "bg-amber-500"
                        : "bg-red-500"
                  )}
                />
              </div>
            </div>

            {/* Last 30 days comparison */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Last 30 Days
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Sent: <span className="font-medium text-foreground">{data.emailPerformance.last_30_sent}</span>
                </span>
                <span className="text-muted-foreground">
                  Failed: <span className="font-medium text-foreground">{data.emailPerformance.last_30_failed}</span>
                </span>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Activity Breakdown + Team Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Breakdown */}
        <ChartCard title="Activity Breakdown" subtitle="By type — last 30 days">
          {mounted && data.activityBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.activityBreakdown} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#888", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fill: "#888", fontSize: 11 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.activityBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No activity in the last 30 days" />
          )}
        </ChartCard>

        {/* Team Activity */}
        <ChartCard title="Team Activity" subtitle="Most active members — last 30 days">
          {data.teamActivity.length > 0 ? (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {data.teamActivity.map((member, idx) => (
                <div
                  key={member.user_id ?? idx}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-xs font-medium text-white">
                    {member.user_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.user_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last active {formatRelativeTime(member.last_active)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">{member.activity_count}</span>
                    <span className="text-xs text-muted-foreground ml-1">actions</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="No team activity recorded" />
          )}
        </ChartCard>
      </div>

      {/* Automation Summary */}
      <ChartCard title="Automation Summary" subtitle="Workflow status and performance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AutomationStat label="Total Workflows" value={data.automationMetrics.total_workflows} />
          <AutomationStat
            label="Active"
            value={data.automationMetrics.active_workflows}
            icon={Zap}
            iconColor="text-emerald-400"
          />
          <AutomationStat
            label="Paused"
            value={data.automationMetrics.paused_workflows}
            icon={Clock}
            iconColor="text-amber-400"
          />
          <AutomationStat label="Total Runs" value={data.automationMetrics.total_runs} />
        </div>
      </ChartCard>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  color: "indigo" | "amber" | "emerald" | "purple";
}) {
  const colorMap = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", colorMap[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tracking-tight">{value}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{subtext}</p>
    </motion.div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}

function EmailStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3 text-center">
      <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />
      <p className="text-lg font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AutomationStat({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: number;
  icon?: React.ElementType;
  iconColor?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={cn("h-3.5 w-3.5", iconColor)} />}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
      {label}
    </div>
  );
}
