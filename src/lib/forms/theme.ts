import type {
  HyperFormTheme,
  HyperFormBranding,
  HyperFormBorderRadius,
} from "@/lib/supabase/database.types";
import {
  DEFAULT_FORM_THEME,
  DEFAULT_FORM_BRANDING,
} from "@/lib/supabase/database.types";

// Map our radius tokens to actual pixel values
export const RADIUS_MAP: Record<HyperFormBorderRadius, string> = {
  none: "0px",
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "24px",
  full: "9999px",
};

// Google Fonts stack — `system` uses the native stack (no remote load)
export const FONT_STACK: Record<string, string> = {
  Inter: "'Inter', sans-serif",
  "Open Sans": "'Open Sans', sans-serif",
  Roboto: "'Roboto', sans-serif",
  Poppins: "'Poppins', sans-serif",
  Lora: "'Lora', serif",
  "Playfair Display": "'Playfair Display', serif",
  "Space Grotesk": "'Space Grotesk', sans-serif",
  system:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// Fonts that require a Google Fonts <link>
export const GOOGLE_FONTS = [
  "Inter",
  "Open Sans",
  "Roboto",
  "Poppins",
  "Lora",
  "Playfair Display",
  "Space Grotesk",
];

export function googleFontHref(family: string): string | null {
  if (!GOOGLE_FONTS.includes(family)) return null;
  const f = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${f}:wght@400;500;600;700&display=swap`;
}

// Merge a partial/stored theme with defaults so older rows never break
export function resolveTheme(theme?: Partial<HyperFormTheme> | null): HyperFormTheme {
  return { ...DEFAULT_FORM_THEME, ...(theme ?? {}) };
}

export function resolveBranding(
  branding?: Partial<HyperFormBranding> | null
): HyperFormBranding {
  return { ...DEFAULT_FORM_BRANDING, ...(branding ?? {}) };
}

// Determine readable foreground color (black/white) for a given hex bg
export function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0b0b12" : "#ffffff";
}

// Lighten/darken a hex color by a percentage (-100..100)
export function shade(hex: string, percent: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const num = parseInt(c, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Button styling based on the buttonStyle token (uses CSS vars set by themeToCssVars)
export function buttonStyleProps(
  style: HyperFormTheme["buttonStyle"]
): React.CSSProperties {
  switch (style) {
    case "outline":
      return {
        background: "transparent",
        color: "var(--hf-primary)",
        border: "1.5px solid var(--hf-primary)",
        borderRadius: "var(--hf-radius)",
      };
    case "soft":
      return {
        background: "color-mix(in srgb, var(--hf-primary) 16%, transparent)",
        color: "var(--hf-primary)",
        border: "none",
        borderRadius: "var(--hf-radius)",
      };
    case "solid":
    default:
      return {
        background: "var(--hf-primary)",
        color: "var(--hf-primary-fg)",
        border: "none",
        borderRadius: "var(--hf-radius)",
      };
  }
}

// Build the CSS custom properties that style the public form
export function themeToCssVars(theme: HyperFormTheme): React.CSSProperties {
  const radius = RADIUS_MAP[theme.borderRadius] ?? RADIUS_MAP.lg;
  return {
    // @ts-expect-error custom CSS variables
    "--hf-primary": theme.primaryColor,
    "--hf-primary-fg": readableOn(theme.primaryColor),
    "--hf-primary-hover": shade(theme.primaryColor, -8),
    "--hf-bg": theme.backgroundColor,
    "--hf-text": theme.textColor,
    "--hf-muted": shade(theme.textColor, -35),
    "--hf-radius": radius,
    "--hf-font": FONT_STACK[theme.fontFamily] ?? FONT_STACK.Inter,
    "--hf-border": shade(theme.backgroundColor, 14),
    "--hf-input-bg": shade(theme.backgroundColor, 6),
  };
}
