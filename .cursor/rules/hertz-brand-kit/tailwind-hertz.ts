import type { Config } from "tailwindcss";

/**
 * Hertz Brand Tailwind Extension
 *
 * Usage: Import and spread into your tailwind.config.ts
 *
 *   import { hertzTheme } from './.cursor/hertz-brand-kit/tailwind-hertz';
 *   export default {
 *     theme: { extend: hertzTheme },
 *     // ...
 *   } satisfies Config;
 */

export const hertzTheme = {
  colors: {
    // === Primary Brand ===
    hertz: {
      primary: "#FFD100",
      "primary-hover": "#E6BC00",
      "primary-active": "#CC9F00",
      "primary-light": "#FFE566",
      "primary-subtle": "rgba(255, 209, 0, 0.1)",
      "primary-focus": "rgba(255, 209, 0, 0.2)",
      black: "#272425",
      "black-hover": "#1A1A1A",
      "gold-plus": "#C9A94E",
      "gold-plus-light": "#D4B968",
    },

    // === Neutrals (override defaults) ===
    neutral: {
      50: "#F8F8F8",
      100: "#F2F2F2",
      200: "#E5E5E5",
      300: "#CCCCCC",
      400: "#AAAAAA",
      500: "#888888",
      600: "#666666",
      700: "#4A4A4A",
      800: "#333333",
      900: "#1A1A1A",
    },

    // === Semantic ===
    success: {
      DEFAULT: "#2E7D32",
      light: "#E8F5E9",
    },
    error: {
      DEFAULT: "#C62828",
      light: "#FFEBEE",
    },
    warning: {
      DEFAULT: "#F57F17",
      light: "#FFF8E1",
    },
    info: {
      DEFAULT: "#1565C0",
      light: "#E3F2FD",
    },
  },

  fontFamily: {
    display: ["DM Sans", "Figtree", "Inter", "system-ui", "sans-serif"],
    body: ["Inter", "DM Sans", "system-ui", "-apple-system", "sans-serif"],
    mono: ["JetBrains Mono", "Fira Code", "monospace"],
  },

  fontSize: {
    xs: ["0.75rem", { lineHeight: "1.15" }],
    sm: ["0.875rem", { lineHeight: "1.3" }],
    base: ["1rem", { lineHeight: "1.5" }],
    lg: ["1.125rem", { lineHeight: "1.5" }],
    xl: ["1.25rem", { lineHeight: "1.3" }],
    "2xl": ["1.5rem", { lineHeight: "1.3" }],
    "3xl": ["1.875rem", { lineHeight: "1.15" }],
    "4xl": ["2.25rem", { lineHeight: "1.15" }],
    "5xl": ["3rem", { lineHeight: "1.15" }],
    "6xl": ["3.75rem", { lineHeight: "1.1" }],
  },

  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },

  letterSpacing: {
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },

  borderRadius: {
    none: "0px",
    sm: "4px",
    DEFAULT: "6px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    "2xl": "16px",
    full: "9999px",
  },

  boxShadow: {
    sm: "0 1px 2px rgba(39, 36, 37, 0.06)",
    DEFAULT: "0 2px 8px rgba(39, 36, 37, 0.08)",
    md: "0 2px 8px rgba(39, 36, 37, 0.08)",
    lg: "0 4px 16px rgba(39, 36, 37, 0.10)",
    xl: "0 8px 32px rgba(39, 36, 37, 0.12)",
  },

  transitionTimingFunction: {
    hertz: "cubic-bezier(0.4, 0, 0.2, 1)",
  },

  transitionDuration: {
    fast: "150ms",
    DEFAULT: "250ms",
    slow: "400ms",
  },

  screens: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1440px",
  },

  maxWidth: {
    container: "1280px",
  },

  spacing: {
    // Extends Tailwind's default 4px-based scale
    // These aliases map to common Hertz spacing patterns
    "card-padding": "24px",
    "section-padding": "64px",
    "section-padding-mobile": "40px",
    "nav-height": "64px",
    "nav-height-mobile": "56px",
    "input-height": "48px",
  },
} as const;

// === Utility: CSS class shortcuts for common Hertz patterns ===
// Add these to your @layer utilities in global CSS if desired:
//
// .btn-hertz-primary {
//   @apply bg-hertz-primary text-hertz-black font-bold px-6 py-3 rounded-md
//          transition-all duration-fast ease-hertz
//          hover:bg-hertz-primary-hover hover:scale-[1.02]
//          active:bg-hertz-primary-active active:scale-[0.98]
//          disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed;
// }
//
// .btn-hertz-secondary {
//   @apply bg-transparent border-2 border-hertz-black text-hertz-black font-semibold
//          px-6 py-3 rounded-md transition-all duration-fast ease-hertz
//          hover:bg-hertz-black hover:text-white;
// }
//
// .input-hertz {
//   @apply h-[48px] border border-neutral-300 rounded-md px-4
//          text-hertz-black placeholder:text-neutral-500
//          focus:border-hertz-black focus:border-2
//          focus:ring-4 focus:ring-hertz-primary-focus
//          transition-all duration-fast ease-hertz;
// }
//
// .card-hertz {
//   @apply bg-white border border-neutral-200 rounded-lg shadow-md
//          transition-all duration-fast ease-hertz
//          hover:shadow-lg hover:-translate-y-0.5;
// }

export default hertzTheme;
