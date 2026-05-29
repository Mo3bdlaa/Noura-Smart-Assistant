import type { Config } from "tailwindcss";

/**
 * Noura's palette is driven by CSS custom properties so the theme engine
 * (src/lib/theme/compute.ts) can shift the whole app based on her mood + the
 * time of day. The tokens below resolve to `hsl(var(--token))` values that are
 * injected on <html> server-side and updated live on `mood_changed` events.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // warm golden-hour identity derived from Noura's reference images
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        elevated: "hsl(var(--elevated) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        amber: "hsl(var(--amber) / <alpha-value>)",
        gold: "hsl(var(--gold) / <alpha-value>)",
        brown: "hsl(var(--brown) / <alpha-value>)",
        cream: "hsl(var(--cream) / <alpha-value>)",
        // green accent = her eyes
        accent: "hsl(var(--accent) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-noura)", "system-ui", "sans-serif"],
      },
      transitionProperty: {
        theme: "background-color, color, border-color, fill, stroke",
      },
    },
  },
  plugins: [],
};

export default config;
