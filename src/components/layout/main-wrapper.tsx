"use client";

import { usePathname } from "next/navigation";
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
      {children}
    </main>
  );
}
