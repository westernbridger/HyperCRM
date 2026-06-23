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

export type WidgetSize = "small" | "medium" | "large" | "wide" | "tall";
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
  position: number;
  collapsed: boolean;
  visible: boolean;
}

export const WIDGET_SIZES: Record<WidgetSize, { cols: number }> = {
  small: { cols: 1 },
  medium: { cols: 1 },
  large: { cols: 2 },
  wide: { cols: 2 },
  tall: { cols: 1 },
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

// Default widget configuration
export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "leads", type: "leads", title: "Lead Ingestion Velocity", size: "wide", position: 0, collapsed: false, visible: true },
  { id: "activity", type: "activity", title: "Live CRM Activity Pulse", size: "tall", position: 1, collapsed: false, visible: true },
  { id: "ai-composer", type: "ai-composer", title: "AI Composer Quick-Dock", size: "medium", position: 2, collapsed: false, visible: true },
  { id: "meta", type: "meta", title: "Meta Ads Monitor", size: "medium", position: 3, collapsed: false, visible: true },
  { id: "contacts", type: "contacts", title: "Total Contacts", size: "small", position: 4, collapsed: false, visible: true },
  { id: "conversion", type: "conversion", title: "Conversion Rate", size: "small", position: 5, collapsed: false, visible: true },
  { id: "weather", type: "weather", title: "Weather", size: "medium", position: 6, collapsed: false, visible: true },
  { id: "news", type: "news", title: "Industry News", size: "tall", position: 7, collapsed: false, visible: true },
];
