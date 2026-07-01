"use client";

import {
  GripVertical,
  MoreHorizontal,
  EyeOff,
} from "lucide-react";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Widget Card — fixed-size "post-it" with internal scroll, no collapse.
export function WidgetCard({
  children,
  className = "",
  title,
  onToggleVisibility,
  dragHandleProps,
  isDragging,
  isOverlay,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  onToggleVisibility: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow duration-200 ${
        isOverlay
          ? "border-amber-500/30 shadow-2xl shadow-black/50 ring-1 ring-amber-500/20"
          : isDragging
            ? "border-dashed border-border/40 bg-card/20 opacity-30"
            : "border-border shadow-sm hover:shadow-md"
      } ${className}`}
    >
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3 pb-2 cursor-default shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded transition-colors shrink-0"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground truncate">
            {title}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground/50 hover:text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleVisibility}>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Widget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 overflow-y-auto p-3 pt-0">
        {children}
      </CardContent>
    </div>
  );
}
