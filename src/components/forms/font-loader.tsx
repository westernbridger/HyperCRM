"use client";

import { useEffect } from "react";
import { googleFontHref } from "@/lib/forms/theme";

// Injects a Google Fonts <link> for the given family (no-op for system fonts).
export function FontLoader({ family }: { family: string }) {
  useEffect(() => {
    const href = googleFontHref(family);
    if (!href) return;

    const id = `hf-font-${family.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [family]);

  return null;
}
