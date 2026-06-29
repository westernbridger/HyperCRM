"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PUBLIC_PREFIXES = ["/forms/", "/checklists/"];

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <main
      className={cn(
        "flex-1 h-screen overflow-y-auto",
        !isPublic && "p-6 md:p-8"
      )}
    >
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </main>
  );
}
