"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  MoreHorizontal,
  Maximize2,
  ChevronDown,
  ChevronUp,
  EyeOff,
} from "lucide-react";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Widget Card Component with Collapsible & Drag Controls
export function WidgetCard({
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
