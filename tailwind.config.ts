import type { Config } from "tailwindcss";

/**
 * Noura Design System — tokens.
 *
 * Every colour resolves to a CSS custom property so the theme engine
 * (src/lib/theme/compute.ts) can shift the whole UI based on the assistant's
 * mood + the time of day. Tokens are injected on <html> server-side and updated
 * live on `mood_changed` events. See DESIGN_SYSTEM.md for the full spec.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- surfaces (back to front) ---
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        elevated: "hsl(var(--elevated) / <alpha-value>)",
        overlay: "hsl(var(--overlay) / <alpha-value>)",

        // --- text ---
        ink: "hsl(var(--ink) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        faint: "hsl(var(--faint) / <alpha-value>)",
        "on-accent": "hsl(var(--on-accent) / <alpha-value>)",

        // --- warm brand family (golden-hour identity) ---
        amber: "hsl(var(--amber) / <alpha-value>)",
        gold: "hsl(var(--gold) / <alpha-value>)",
        brown: "hsl(var(--brown) / <alpha-value>)",
        cream: "hsl(var(--cream) / <alpha-value>)",

        // --- accent (her eyes; mood-driven hue/sat) ---
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-soft": "hsl(var(--accent-soft) / <alpha-value>)",

        // --- lines ---
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",

        // --- feedback ---
        danger: "hsl(var(--danger) / <alpha-value>)",
        "danger-soft": "hsl(var(--danger-soft) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        "success-soft": "hsl(var(--success-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-noura)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 16px)",
      },
      boxShadow: {
        soft: "0 1px 2px 0 hsl(var(--shadow) / 0.04), 0 2px 8px -2px hsl(var(--shadow) / 0.08)",
        raised:
          "0 2px 4px -1px hsl(var(--shadow) / 0.06), 0 8px 24px -4px hsl(var(--shadow) / 0.14)",
        glow: "0 0 0 1px hsl(var(--accent) / 0.18), 0 8px 32px -8px hsl(var(--accent) / 0.35)",
        "inner-top": "inset 0 1px 0 0 hsl(var(--border) / 0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        typing: {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: ".5" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in .3s ease both",
        "slide-up": "slide-up .35s cubic-bezier(.2,.8,.2,1) both",
        pop: "pop .2s ease both",
        typing: "typing 1.2s infinite ease-in-out",
        "pulse-glow": "pulse-glow 2.4s infinite ease-in-out",
      },
      transitionProperty: {
        theme: "background-color, color, border-color, fill, stroke, box-shadow",
      },
    },
  },
  plugins: [],
};

export default config;
