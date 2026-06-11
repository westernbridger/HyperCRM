"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Masonry from "react-masonry-css";
import { 
  getDashboardLayouts, 
  saveDashboardLayouts, 
  type WidgetLayout 
} from "@/lib/data/dashboard";
import { getDashboardStats, getLeadsByDay, getRecentActivities, type RecentActivity } from "@/lib/data/contacts";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GripVertical,
  MoreHorizontal,
  Zap,
  Activity,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  Send,
  Sparkles,
  Globe,
  Webhook,
  Users,
  FileText,
  BarChart3,
  RefreshCw,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Sun,
  Newspaper,
  MapPin,
  Thermometer,
  Wind,
  Droplets,
  LayoutGrid,
  Eye,
  EyeOff,
} from "lucide-react";

// ============ TYPES & CONFIG ============
type WidgetSize = "small" | "medium" | "large" | "wide" | "tall";
type WidgetType = "leads" | "activity" | "ai-composer" | "meta" | "contacts" | "conversion" | "weather" | "news";

interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: number;
  collapsed: boolean;
  visible: boolean;
}

const WIDGET_SIZES: Record<WidgetSize, { cols: number }> = {
  small: { cols: 1 },
  medium: { cols: 1 },
  large: { cols: 2 },
  wide: { cols: 2 },
  tall: { cols: 1 },
};

// Activity type → icon/color map
const ACTIVITY_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  note:          { icon: FileText,     color: "text-blue-400" },
  email:         { icon: Mail,         color: "text-amber-400" },
  call:          { icon: Phone,        color: "text-cyan-400" },
  meeting:       { icon: CheckCircle2, color: "text-emerald-400" },
  document:      { icon: FileText,     color: "text-purple-400" },
  status_change: { icon: RefreshCw,    color: "text-pink-400" },
  creation:      { icon: Zap,          color: "text-emerald-400" },
};

// Mock weather data
const weatherData = {
  location: "San Francisco, CA",
  temp: 72,
  condition: "Partly Cloudy",
  high: 75,
  low: 62,
  humidity: 65,
  wind: 12,
  forecast: [
    { day: "Mon", icon: Sun, temp: 74 },
    { day: "Tue", icon: Cloud, temp: 70 },
    { day: "Wed", icon: CloudRain, temp: 68 },
    { day: "Thu", icon: Sun, temp: 75 },
    { day: "Fri", icon: Sun, temp: 76 },
  ],
};

// Mock news data
const newsHeadlines = [
  { id: 1, title: "CRM Market Growth Accelerates with AI Integration", source: "TechCrunch", time: "2h ago", category: "Industry" },
  { id: 2, title: "Meta Announces New Lead Gen API Features", source: "Marketing Week", time: "4h ago", category: "Product" },
  { id: 3, title: "Sales Teams See 40% Boost with Automation Tools", source: "Salesforce Blog", time: "6h ago", category: "Research" },
  { id: 4, title: "Privacy Regulations Impact Lead Tracking", source: "Compliance Daily", time: "8h ago", category: "Legal" },
  { id: 5, title: "AI-Powered Email Campaigns Drive Higher Engagement", source: "HubSpot", time: "12h ago", category: "Marketing" },
];

// Default widget configuration
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "leads", type: "leads", title: "Lead Ingestion Velocity", size: "wide", position: 0, collapsed: false, visible: true },
  { id: "activity", type: "activity", title: "Live CRM Activity Pulse", size: "tall", position: 1, collapsed: false, visible: true },
  { id: "ai-composer", type: "ai-composer", title: "AI Composer Quick-Dock", size: "medium", position: 2, collapsed: false, visible: true },
  { id: "meta", type: "meta", title: "Meta Ads Monitor", size: "medium", position: 3, collapsed: false, visible: true },
  { id: "contacts", type: "contacts", title: "Total Contacts", size: "small", position: 4, collapsed: false, visible: true },
  { id: "conversion", type: "conversion", title: "Conversion Rate", size: "small", position: 5, collapsed: false, visible: true },
  { id: "weather", type: "weather", title: "Weather", size: "medium", position: 6, collapsed: false, visible: true },
  { id: "news", type: "news", title: "Industry News", size: "tall", position: 7, collapsed: false, visible: true },
];

// Widget Card Component with Collapsible & Drag Controls
function WidgetCard({
  children,
  className = "",
  title,
  collapsed,
  onToggleCollapse,
  onToggleVisibility,
  dragHandleProps,
  isDragging,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleVisibility: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}) {
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm ${isDragging ? "ring-2 ring-primary/50 z-50 shadow-xl" : ""} ${className}`}
      style={{ minHeight: collapsed ? "52px" : undefined }}
    >
      {/* Animated gradient border on hover */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20" />
      </div>
      
      <CardHeader className={`relative flex flex-row items-center justify-between ${collapsed ? "pb-4" : "pb-2"} cursor-default`}>
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/50 transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {/* Collapse Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleCollapse}>
                {collapsed ? <Maximize2 className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                {collapsed ? "Expand" : "Collapse"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleVisibility}>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Widget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <AnimatePresence initial={false} mode="wait">
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="overflow-hidden"
          >
            <CardContent className="relative p-4 pt-0">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Lead Ingestion Velocity Widget — live from Supabase
function LeadIngestionVelocity() {
  const [mounted, setMounted] = useState(false);
  const [leadData, setLeadData] = useState<{ day: string; leads: number }[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    getLeadsByDay().then((data) => {
      setLeadData(data);
      setTotalThisWeek(data.reduce((sum, d) => sum + d.leads, 0));
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[160px] w-full min-h-[160px]">
        {mounted && (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={leadData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              />
              <Area type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center justify-between pt-2">
        <div>
          {totalThisWeek === null ? (
            <div className="h-8 w-10 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold">{totalThisWeek}</p>
          )}
          <p className="text-xs text-muted-foreground">New contacts this week</p>
        </div>
        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
          Last 7 days
        </Badge>
      </div>
    </div>
  );
}

// Live CRM Activity Pulse Widget — live from Supabase
function LiveActivityPulse() {
  const router = useRouter();
  const [events, setEvents] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentActivities().then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, []);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading activity…</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
        <Activity className="h-8 w-8 opacity-30" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-3 pb-4">
        {events.map((event, i) => {
          const cfg = ACTIVITY_ICON_MAP[event.type] ?? { icon: Zap, color: "text-muted-foreground" };
          const Icon = cfg.icon;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/contacts/${event.contact_id}`)}
              className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted cursor-pointer group"
            >
              <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                  {event.title}
                  {event.contact_name && (
                    <span className="font-normal text-muted-foreground"> — {event.contact_name}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</span>
                  {event.performed_by && (
                    <>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground">by {event.performed_by}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-0.5" />
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// AI Composer Quick-Dock Widget
function AIComposerDock() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGenerated(true);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-400" />
        <span className="text-sm font-medium">AI Email Composer</span>
      </div>
      
      {generated ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-muted p-3 space-y-2"
        >
          <p className="text-sm font-medium">Generated Template:</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Subject: Exclusive Offer for {prompt}...
            <br /><br />
            Hi {'{first_name}'},<br />
            I noticed your interest in {prompt}. I wanted to personally reach out...
          </p>
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="flex-1">
              <Send className="mr-2 h-3 w-3" />
              Use Template
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setGenerated(false); setPrompt(""); }}>
              Reset
            </Button>
          </div>
        </motion.div>
      ) : (
        <>
          <Input
            placeholder="What do you want to draft?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-muted/50"
          />
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Template
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}

// Meta Ads Campaign Monitor Widget
function MetaAdsMonitor() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Meta Integration</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400">Not connected</Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Active Forms</p>
          <p className="text-base font-bold">4</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Ad Groups</p>
          <p className="text-base font-bold">12</p>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-1.5">
          <div className="flex items-center gap-2">
            <Webhook className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs">Live Webhook</span>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1 py-0">
            <span className="mr-1 inline-block h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
            Operational
          </Badge>
        </div>
        
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs">Lead Sync</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">Active</Badge>
        </div>
        
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-1.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs">Attribution</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">Tracking</Badge>
        </div>
      </div>
      
      <div className="pt-1">
        <p className="text-[10px] text-muted-foreground mb-1">Recent Sync Activity</p>
        <div className="flex items-center gap-2 text-xs">
          <RefreshCw className="h-3 w-3 text-emerald-400" />
          <span>Last sync: 2 minutes ago</span>
        </div>
      </div>
    </div>
  );
}

// Weather Widget
function WeatherWidget() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400">Demo data</Badge>
      </div>
      {/* Current Weather */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-2">
            <Sun className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{weatherData.temp}°</p>
            <p className="text-xs text-muted-foreground">{weatherData.condition}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {weatherData.location}
          </div>
        </div>
      </div>

      {/* Weather Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-1.5 text-center">
          <Thermometer className="mx-auto h-3 w-3 text-amber-400 mb-0.5" />
          <p className="text-xs font-medium">{weatherData.high}°/{weatherData.low}°</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5 text-center">
          <Droplets className="mx-auto h-3 w-3 text-blue-400 mb-0.5" />
          <p className="text-xs font-medium">{weatherData.humidity}%</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5 text-center">
          <Wind className="mx-auto h-3 w-3 text-cyan-400 mb-0.5" />
          <p className="text-xs font-medium">{weatherData.wind}mph</p>
        </div>
      </div>

      {/* 5-Day Forecast */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-1">5-Day Forecast</p>
        <div className="flex justify-between gap-1">
          {weatherData.forecast.map((day) => (
            <div key={day.day} className="flex flex-col items-center rounded-md bg-muted/30 px-1.5 py-1 flex-1">
              <p className="text-[10px] font-medium">{day.day}</p>
              <day.icon className="my-0.5 h-3 w-3 text-amber-400" />
              <p className="text-[10px]">{day.temp}°</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// News Widget
function NewsWidget() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pr-4">
        <div className="flex justify-end pb-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400">Demo data</Badge>
        </div>
        {newsHeadlines.map((news) => (
          <motion.div
            key={news.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: news.id * 0.1 }}
            className="group cursor-pointer rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-md bg-primary/10 p-1">
                <Newspaper className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                  {news.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">{news.category}</Badge>
                  <span>{news.source}</span>
                  <span>•</span>
                  <span>{news.time}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Total Contacts Widget — live from Supabase
function TotalContactsWidget() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    getDashboardStats().then((s) => setTotal(s.totalContacts));
  }, []);

  return (
    <div className="flex items-center justify-between h-full">
      <div>
        {total === null ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold">{total.toLocaleString()}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">Total contacts</p>
      </div>
      <Users className="h-7 w-7 text-muted-foreground/30" />
    </div>
  );
}

// Conversion Rate Widget — leads → customers ratio from Supabase
function ConversionRateWidget() {
  const [rate, setRate] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats().then((s) => {
      const pct =
        s.totalContacts > 0
          ? ((s.customersCount / s.totalContacts) * 100).toFixed(1)
          : "0.0";
      setRate(pct);
    });
  }, []);

  return (
    <div className="flex items-center justify-between h-full">
      <div>
        {rate === null ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold">{rate}%</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">Leads → Customers</p>
      </div>
      <Activity className="h-7 w-7 text-muted-foreground/30" />
    </div>
  );
}

// Widget Renderer
function renderWidget(type: WidgetType) {
  switch (type) {
    case "leads":
      return <LeadIngestionVelocity />;
    case "activity":
      return <LiveActivityPulse />;
    case "ai-composer":
      return <AIComposerDock />;
    case "meta":
      return <MetaAdsMonitor />;
    case "contacts":
      return <TotalContactsWidget />;
    case "conversion":
      return <ConversionRateWidget />;
    case "weather":
      return <WeatherWidget />;
    case "news":
      return <NewsWidget />;
    default:
      return null;
  }
}

// Get grid classes based on widget size
function getGridClasses(size: WidgetSize): string {
  const { cols } = WIDGET_SIZES[size];
  return `md:col-span-${cols}`;
}

// Get minimum height based on widget size - only enforce min for visual consistency
function getMinHeight(size: WidgetSize): string {
  switch (size) {
    case "tall":
      return "min-h-[200px]"; // Tall content needs some space
    case "large":
      return "min-h-[200px]"; // Large content needs some space
    case "wide":
      return "min-h-[140px]"; // Wide widgets are shorter
    default:
      return ""; // Small/Medium widgets size naturally
  }
}

// Sortable Widget Item Component
function SortableWidget({
  widget,
  onToggleCollapse,
  onToggleVisibility,
}: {
  widget: WidgetConfig;
  onToggleCollapse: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-4"
    >
      <WidgetCard
        title={widget.title}
        collapsed={widget.collapsed}
        onToggleCollapse={() => onToggleCollapse(widget.id)}
        onToggleVisibility={() => onToggleVisibility(widget.id)}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      >
        {renderWidget(widget.type)}
      </WidgetCard>
    </div>
  );
}

// Main Board Tab Content with Drag & Drop Grid
function MainBoard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Mount effect to prevent SSR hydration issues and load layout
  useEffect(() => {
    async function loadLayout() {
      // Load from Supabase (falls back to localStorage if not logged in)
      const savedLayouts = await getDashboardLayouts();
      
      if (savedLayouts && savedLayouts.length > 0) {
        // Apply saved positions to default widgets
        const updatedWidgets = DEFAULT_WIDGETS.map(widget => {
          const saved = savedLayouts.find((l: WidgetLayout) => l.id === widget.id);
          return saved ? { ...widget, position: saved.position, visible: saved.visible } : widget;
        });
        setWidgets(updatedWidgets);
        // Track hidden widgets
        const hidden = savedLayouts.filter((l: WidgetLayout) => !l.visible).map((l: WidgetLayout) => l.id);
        setHiddenWidgets(hidden);
      }
      
      setLayoutLoaded(true);
      setMounted(true);
    }
    
    loadLayout();
  }, []);

  // Save to Supabase/localStorage when layout changes
  useEffect(() => {
    if (!mounted) return; // Don't save on initial load
    
    // Convert to WidgetLayout format
    const layouts: WidgetLayout[] = widgets.map(w => ({
      id: w.id,
      position: w.position,
      visible: !hiddenWidgets.includes(w.id),
    }));
    
    saveDashboardLayouts(layouts);
  }, [widgets, hiddenWidgets, mounted]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        // Reorder the array and save immediately
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Save to localStorage immediately on drag end
        const updatedWidgets = newItems.map((w, i) => ({ ...w, position: i }));
        localStorage.setItem(
          "hypercrm_dashboard_layout",
          JSON.stringify({ widgets: updatedWidgets, hidden: hiddenWidgets })
        );
        return updatedWidgets;
      });
    }

    setActiveId(null);
  };

  const toggleCollapse = (id: string) => {
    setWidgets(widgets.map(w => 
      w.id === id ? { ...w, collapsed: !w.collapsed } : w
    ));
  };

  const toggleVisibility = (id: string) => {
    if (hiddenWidgets.includes(id)) {
      setHiddenWidgets(hiddenWidgets.filter(w => w !== id));
    } else {
      setHiddenWidgets([...hiddenWidgets, id]);
    }
  };

  const showAllWidgets = () => {
    setHiddenWidgets([]);
  };

  // Sort widgets by position and filter hidden
  const visibleWidgets = widgets
    .filter(w => !hiddenWidgets.includes(w.id))
    .sort((a, b) => a.position - b.position);
  const activeWidget = activeId ? widgets.find(w => w.id === activeId) : null;

  return (
    <div className="space-y-4">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="h-4 w-4" />
            <span>Snap Grid Layout</span>
          </div>
          {hiddenWidgets.length > 0 && (
            <Button variant="ghost" size="sm" onClick={showAllWidgets} className="gap-2">
              <Eye className="h-4 w-4" />
              Show Hidden ({hiddenWidgets.length})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          <span>Drag to reorder</span>
        </div>
      </div>

      {/* Masonry Grid - Widgets pack tightly into columns */}
      {mounted && layoutLoaded ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleWidgets.map(w => w.id)}
            strategy={rectSortingStrategy}
          >
            <Masonry
              breakpointCols={{ default: 4, 1100: 3, 768: 2, 480: 1 }}
              className="masonry-grid"
              columnClassName="masonry-grid-column"
            >
              {visibleWidgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  onToggleCollapse={toggleCollapse}
                  onToggleVisibility={toggleVisibility}
                />
              ))}
            </Masonry>
          </SortableContext>

          {/* Drag Overlay for smooth visual feedback */}
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: "0.5",
                  },
                },
              }),
            }}
          >
            {activeWidget ? (
              <div className={activeWidget.size === "wide" || activeWidget.size === "large" ? "col-span-2" : ""}>
                <WidgetCard
                  title={activeWidget.title}
                  className="shadow-2xl ring-2 ring-primary/50"
                  collapsed={activeWidget.collapsed}
                  onToggleCollapse={() => {}}
                  onToggleVisibility={() => {}}
                  isDragging={true}
                >
                  {renderWidget(activeWidget.type)}
                </WidgetCard>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : layoutLoaded ? (
        /* Static masonry after layout loaded (tab switch) */
        <Masonry
          breakpointCols={{ default: 4, 1100: 3, 768: 2, 480: 1 }}
          className="masonry-grid"
          columnClassName="masonry-grid-column"
        >
          {visibleWidgets.map((widget) => (
            <div key={widget.id} className="mb-4">
              <WidgetCard
                title={widget.title}
                collapsed={widget.collapsed}
                onToggleCollapse={() => toggleCollapse(widget.id)}
                onToggleVisibility={() => toggleVisibility(widget.id)}
              >
                {renderWidget(widget.type)}
              </WidgetCard>
            </div>
          ))}
        </Masonry>
      ) : (
        /* Loading placeholder during SSR and initial load */
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}

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
