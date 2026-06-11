"use client";

import { motion } from "framer-motion";
import { Mail, Phone, UserPlus, FileText, CheckCircle } from "lucide-react";

const activities = [
  { id: 1, type: "contact", text: "Sarah Miller added as a new contact", time: "2 min ago", icon: UserPlus },
  { id: 2, type: "email", text: "Email campaign sent to 1,240 leads", time: "15 min ago", icon: Mail },
  { id: 3, type: "call", text: "Follow-up call with Acme Corp completed", time: "1 hour ago", icon: Phone },
  { id: 4, type: "document", text: "Proposal v3 uploaded for review", time: "3 hours ago", icon: FileText },
  { id: 5, type: "conversion", text: "Lead converted: James Wilson", time: "5 hours ago", icon: CheckCircle },
];

export function RecentActivity() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold">Recent Activity</h3>
      <div className="mt-4 space-y-4">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
              <activity.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{activity.text}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
