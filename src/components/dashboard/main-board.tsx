"use client";

import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDashboardLayouts,
  saveDashboardLayouts,
  type WidgetLayout,
} from "@/lib/data/dashboard";
import { DEFAULT_WIDGETS, type WidgetConfig } from "@/components/dashboard/config";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { renderWidget } from "@/components/dashboard/widgets";

// Main Board — traditional responsive grid with collapsible widgets.
export function MainBoard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  // Load saved layout
  useEffect(() => {
    async function loadLayout() {
      const savedLayouts = await getDashboardLayouts();

      if (savedLayouts && savedLayouts.length > 0) {
        const updatedWidgets = DEFAULT_WIDGETS.map(widget => {
          const saved = savedLayouts.find((l: WidgetLayout) => l.id === widget.id);
          return saved
            ? {
                ...widget,
                position: saved.position ?? widget.position,
                collapsed: saved.collapsed ?? widget.collapsed,
                visible: saved.visible,
              }
            : widget;
        });
        setWidgets(updatedWidgets);
        const hidden = savedLayouts
          .filter((l: WidgetLayout) => !l.visible)
          .map((l: WidgetLayout) => l.id);
        setHiddenWidgets(hidden);
      }

      setLayoutLoaded(true);
      setMounted(true);
    }

    loadLayout();
  }, []);

  // Save layout on change
  useEffect(() => {
    if (!mounted) return;

    const layouts: WidgetLayout[] = widgets.map(w => ({
      id: w.id,
      position: w.position,
      collapsed: w.collapsed,
      visible: !hiddenWidgets.includes(w.id),
    }));

    saveDashboardLayouts(layouts);
  }, [widgets, hiddenWidgets, mounted]);

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

  const showAllWidgets = () => setHiddenWidgets([]);

  const visibleWidgets = widgets
    .filter(w => !hiddenWidgets.includes(w.id))
    .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      {/* Controls */}
      {hiddenWidgets.length > 0 && (
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={showAllWidgets}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            Show {hiddenWidgets.length} hidden
          </Button>
        </div>
      )}

      {/* Widget Grid */}
      {mounted && layoutLoaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleWidgets.map(widget => (
            <div
              key={widget.id}
              className={widget.size === "small" ? "sm:col-span-1" : "sm:col-span-2"}
            >
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
        </div>
      ) : (
        /* Loading skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-border/50 bg-card/50 animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}
