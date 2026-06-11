"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface MetricTileProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  active?: boolean;
}

export function MetricTile({ title, value, change, icon: Icon, active }: MetricTileProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-5"
    >
      {/* Animated gradient border overlay on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-0 rounded-xl p-[1px]">
          <div className="animate-border absolute inset-0 rounded-xl opacity-60" />
        </div>
      </div>

      {/* Active state glow */}
      {active && (
        <motion.div
          layoutId="active-tile"
          className="absolute inset-0 rounded-xl ring-1 ring-primary/40"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}

      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-emerald-400">{change}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}
