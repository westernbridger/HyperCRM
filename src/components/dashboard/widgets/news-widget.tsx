"use client";

import { motion } from "framer-motion";
import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { newsHeadlines } from "@/components/dashboard/config";

// News Widget (demo data)
export function NewsWidget() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pr-4">
        <div className="flex justify-end pb-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400">Demo data</Badge>
        </div>
        {newsHeadlines.map((news) => (
          <motion.div
            key={news.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: news.id * 0.1 }}
            className="group cursor-pointer rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-md bg-primary/10 p-1">
                <Newspaper className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                  {news.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">{news.category}</Badge>
                  <span>{news.source}</span>
                  <span>•</span>
                  <span>{news.time}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}
