"use client";

import { useState, useEffect } from "react";
import Masonry from "react-masonry-css";
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
import { GripVertical, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDashboardLayouts,
  saveDashboardLayouts,
  type WidgetLayout,
} from "@/lib/data/dashboard";
import { DEFAULT_WIDGETS, type WidgetConfig } from "@/components/dashboard/config";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { renderWidget } from "@/components/dashboard/widgets";

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
    <div ref={setNodeRef} style={style} className="mb-4">
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
export function MainBoard() {
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
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-4">
          {hiddenWidgets.length > 0 && (
            <Button variant="ghost" size="sm" onClick={showAllWidgets} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Eye className="h-3.5 w-3.5" />
              Show {hiddenWidgets.length} hidden
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <GripVertical className="h-3.5 w-3.5" />
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
            <div key={i} className="h-32 rounded-xl border border-border/50 bg-card/50 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
