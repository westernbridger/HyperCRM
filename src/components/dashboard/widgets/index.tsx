import type { WidgetType } from "@/components/dashboard/config";
import { LeadIngestionVelocity } from "./lead-ingestion-velocity";
import { LiveActivityPulse } from "./live-activity-pulse";
import { AIComposerDock } from "./ai-composer-dock";
import { MetaAdsMonitor } from "./meta-ads-monitor";
import { WeatherWidget } from "./weather-widget";
import { NewsWidget } from "./news-widget";
import { TotalContactsWidget, ConversionRateWidget } from "./stat-widgets";

// Maps a widget type to its rendered component.
export function renderWidget(type: WidgetType) {
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
