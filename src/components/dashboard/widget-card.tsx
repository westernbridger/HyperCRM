"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal,
  Maximize2,
  Minimize2,
  EyeOff,
} from "lucide-react";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Widget Card — collapsible with smooth Framer Motion transitions.
export function WidgetCard({
  children,
  className = "",
  title,
  collapsed,
  onToggleCollapse,
  onToggleVisibility,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ${
        collapsed
          ? "border-border shadow-sm"
          : "border-border shadow-sm hover:shadow-md"
      } ${className}`}
    >
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 cursor-default">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate">
          {title}
        </CardTitle>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleCollapse}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
          >
            {collapsed ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-6 w-6 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground/50 hover:text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleCollapse}>
                {collapsed ? (
                  <Maximize2 className="mr-2 h-4 w-4" />
                ) : (
                  <Minimize2 className="mr-2 h-4 w-4" />
                )}
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

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <CardContent className="relative p-4 pt-0">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
