// Dashboard widget types, sizing config and demo data.
import {
  FileText,
  Mail,
  Phone,
  CheckCircle2,
  RefreshCw,
  Zap,
  Sun,
  Cloud,
  CloudRain,
} from "lucide-react";

export type WidgetSize = "small" | "large";
export type WidgetType =
  | "leads"
  | "activity"
  | "ai-composer"
  | "meta"
  | "contacts"
  | "conversion"
  | "weather"
  | "news";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  x: number;
  y: number;
  visible: boolean;
}

// Snap interval for the free-form canvas (pixels).
export const GRID = 40;

// Fixed footprints per size (multiples of GRID).
export const WIDGET_SIZES: Record<WidgetSize, { w: number; h: number }> = {
  small: { w: 200, h: 160 },
  large: { w: 400, h: 320 },
};

// Activity type → icon/color map
export const ACTIVITY_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  note:          { icon: FileText,     color: "text-blue-400" },
  email:         { icon: Mail,         color: "text-amber-400" },
  call:          { icon: Phone,        color: "text-cyan-400" },
  meeting:       { icon: CheckCircle2, color: "text-emerald-400" },
  document:      { icon: FileText,     color: "text-purple-400" },
  status_change: { icon: RefreshCw,    color: "text-pink-400" },
  creation:      { icon: Zap,          color: "text-emerald-400" },
};

// Mock weather data
export const weatherData = {
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
export const newsHeadlines = [
  { id: 1, title: "CRM Market Growth Accelerates with AI Integration", source: "TechCrunch", time: "2h ago", category: "Industry" },
  { id: 2, title: "Meta Announces New Lead Gen API Features", source: "Marketing Week", time: "4h ago", category: "Product" },
  { id: 3, title: "Sales Teams See 40% Boost with Automation Tools", source: "Salesforce Blog", time: "6h ago", category: "Research" },
  { id: 4, title: "Privacy Regulations Impact Lead Tracking", source: "Compliance Daily", time: "8h ago", category: "Legal" },
  { id: 5, title: "AI-Powered Email Campaigns Drive Higher Engagement", source: "HubSpot", time: "12h ago", category: "Marketing" },
];

// Default widget configuration — free-form canvas positions (x, y in px).
// Layout: two rows of large content widgets, stat widgets stacked on the right.
export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "leads",       type: "leads",       title: "Lead Ingestion Velocity", size: "large", x: 0,    y: 0,   visible: true },
  { id: "activity",    type: "activity",    title: "Live CRM Activity Pulse", size: "large", x: 440,  y: 0,   visible: true },
  { id: "ai-composer", type: "ai-composer", title: "AI Composer Quick-Dock",  size: "large", x: 880,  y: 0,   visible: true },
  { id: "contacts",    type: "contacts",    title: "Total Contacts",          size: "small", x: 1320, y: 0,   visible: true },
  { id: "conversion",  type: "conversion",  title: "Conversion Rate",         size: "small", x: 1320, y: 200, visible: true },
  { id: "meta",        type: "meta",        title: "Meta Ads Monitor",        size: "large", x: 0,    y: 360, visible: true },
  { id: "weather",     type: "weather",     title: "Weather",                 size: "large", x: 440,  y: 360, visible: true },
  { id: "news",        type: "news",        title: "Industry News",           size: "large", x: 880,  y: 360, visible: true },
];
