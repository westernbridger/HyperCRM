"use client";

import { motion } from "framer-motion";
import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { newsHeadlines } from "@/components/dashboard/config";

// News Widget (demo data)
export function NewsWidget() {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="space-y-3 pr-4">
        <div className="flex justify-end pb-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">Demo data</Badge>
        </div>
        {newsHeadlines.map((news) => (
          <motion.div
            key={news.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: news.id * 0.1 }}
            className="group cursor-pointer rounded-lg border border-border/50 bg-secondary/20 p-3 transition-colors hover:bg-secondary/40 hover:border-border"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-md bg-muted/60 p-1">
                <Newspaper className="h-3 w-3 text-muted-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug group-hover:text-foreground transition-colors">
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
