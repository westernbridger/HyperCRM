"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDashboardLayouts,
  saveDashboardLayouts,
  type WidgetLayout,
} from "@/lib/data/dashboard";
import {
  DEFAULT_WIDGETS,
  GRID,
  WIDGET_SIZES,
  type WidgetConfig,
} from "@/components/dashboard/config";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { renderWidget } from "@/components/dashboard/widgets";

// ── Helpers ───────────────────────────────────────────────────────────────────

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function findNearestFreeSlot(
  x: number, y: number, w: number, h: number,
  others: { x: number; y: number; w: number; h: number }[],
): { x: number; y: number } {
  const sx = snap(x);
  const sy = snap(y);

  // Check original snapped position first
  const collides = others.some(o => rectsOverlap(sx, sy, w, h, o.x, o.y, o.w, o.h));
  if (!collides) return { x: sx, y: sy };

  // Spiral search for nearest free slot
  for (let radius = 1; radius <= 20; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const cx = sx + dx * GRID;
        const cy = sy + dy * GRID;
        const cxClamped = Math.max(0, cx);
        const cyClamped = Math.max(0, cy);
        const collides2 = others.some(o =>
          rectsOverlap(cxClamped, cyClamped, w, h, o.x, o.y, o.w, o.h),
        );
        if (!collides2) return { x: cxClamped, y: cyClamped };
      }
    }
  }

  return { x: sx, y: sy };
}

// ── Draggable Widget ──────────────────────────────────────────────────────────

function DraggableWidget({
  widget,
  onToggleVisibility,
  canvasRef,
}: {
  widget: WidgetConfig;
  onToggleVisibility: (id: string) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const dims = WIDGET_SIZES[widget.size];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
  });

  // Live snapped position for the preview
  const liveX = widget.x + (transform?.x ?? 0);
  const liveY = widget.y + (transform?.y ?? 0);
  const snapX = snap(liveX);
  const snapY = snap(liveY);

  return (
    <>
      {/* Snap preview ghost — shows where the widget will land */}
      {isDragging && (
        <div
          className="absolute rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 pointer-events-none transition-all"
          style={{
            left: snapX,
            top: snapY,
            width: dims.w,
            height: dims.h,
          }}
        />
      )}

      <div
        ref={setNodeRef}
        className="absolute select-none"
        style={{
          left: widget.x,
          top: widget.y,
          width: dims.w,
          height: dims.h,
          transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
          transition: isDragging ? undefined : "left 300ms cubic-bezier(0.2, 0.8, 0.2, 1), top 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          zIndex: isDragging ? 50 : undefined,
        }}
      >
        <WidgetCard
          title={widget.title}
          onToggleVisibility={() => onToggleVisibility(widget.id)}
          dragHandleProps={{ ...attributes, ...listeners }}
          isDragging={isDragging}
        >
          {renderWidget(widget.type)}
        </WidgetCard>
      </div>
    </>
  );
}

// ── Main Board ────────────────────────────────────────────────────────────────

export function MainBoard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Load saved layout
  useEffect(() => {
    async function loadLayout() {
      const savedLayouts = await getDashboardLayouts();

      if (savedLayouts && savedLayouts.length > 0) {
        const updatedWidgets = DEFAULT_WIDGETS.map(widget => {
          const saved = savedLayouts.find((l: WidgetLayout) => l.id === widget.id);
          return saved
            ? { ...widget, x: saved.x, y: saved.y, visible: saved.visible }
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
      x: w.x,
      y: w.y,
      visible: !hiddenWidgets.includes(w.id),
    }));

    saveDashboardLayouts(layouts);
  }, [widgets, hiddenWidgets, mounted]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const id = active.id as string;

    setWidgets(prev => {
      const widget = prev.find(w => w.id === id);
      if (!widget) return prev;

      const dims = WIDGET_SIZES[widget.size];
      const newX = widget.x + delta.x;
      const newY = widget.y + delta.y;

      // Build list of other widgets' rects for collision detection
      const others = prev
        .filter(w => w.id !== id && !hiddenWidgets.includes(w.id))
        .map(w => ({
          x: w.x,
          y: w.y,
          w: WIDGET_SIZES[w.size].w,
          h: WIDGET_SIZES[w.size].h,
        }));

      const slot = findNearestFreeSlot(newX, newY, dims.w, dims.h, others);

      return prev.map(w =>
        w.id === id ? { ...w, x: slot.x, y: slot.y } : w,
      );
    });

    setActiveId(null);
  };

  const toggleVisibility = (id: string) => {
    if (hiddenWidgets.includes(id)) {
      setHiddenWidgets(hiddenWidgets.filter(w => w !== id));
    } else {
      setHiddenWidgets([...hiddenWidgets, id]);
    }
  };

  const showAllWidgets = () => setHiddenWidgets([]);

  const visibleWidgets = widgets.filter(w => !hiddenWidgets.includes(w.id));
  const activeWidget = activeId ? widgets.find(w => w.id === activeId) : null;

  // Compute canvas size from widget positions
  const canvasWidth = Math.max(
    ...visibleWidgets.map(w => w.x + WIDGET_SIZES[w.size].w),
    1200,
  ) + 80;
  const canvasHeight = Math.max(
    ...visibleWidgets.map(w => w.y + WIDGET_SIZES[w.size].h),
    600,
  ) + 80;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-4">
          {hiddenWidgets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={showAllWidgets}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5" />
              Show {hiddenWidgets.length} hidden
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <GripVertical className="h-3.5 w-3.5" />
          <span>Drag widgets anywhere — snaps to 40px grid</span>
        </div>
      </div>

      {/* Canvas */}
      {mounted && layoutLoaded ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={canvasRef}
            className="relative overflow-auto rounded-xl border border-border/30 bg-muted/10"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
              backgroundSize: `${GRID}px ${GRID}px`,
              backgroundPosition: "0 0",
              minHeight: canvasHeight,
              minWidth: canvasWidth,
            }}
          >
            {visibleWidgets.map(widget => (
              <DraggableWidget
                key={widget.id}
                widget={widget}
                onToggleVisibility={toggleVisibility}
                canvasRef={canvasRef}
              />
            ))}
          </div>

          {/* Drag Overlay — floating glass slate */}
          <DragOverlay
            dropAnimation={{
              duration: 300,
              easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            {activeWidget ? (
              <div
                style={{
                  width: WIDGET_SIZES[activeWidget.size].w,
                  height: WIDGET_SIZES[activeWidget.size].h,
                }}
              >
                <WidgetCard
                  title={activeWidget.title}
                  onToggleVisibility={() => {}}
                  isOverlay
                >
                  {renderWidget(activeWidget.type)}
                </WidgetCard>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
