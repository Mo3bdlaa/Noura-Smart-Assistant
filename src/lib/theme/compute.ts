import type { MoodSnapshot } from "@/lib/mood/state";
import type { TimeOfDay } from "@/lib/time/awareness";

/**
 * Compute the live theme as CSS custom properties (HSL component strings used by
 * `hsl(var(--token))` in Tailwind). The palette is the assistant's warm
 * golden-hour identity; it warms up + brightens the accent when she's
 * happy/affectionate, desaturates + cools when she's annoyed, and goes dark &
 * cozy at night. Each user's own assistant mood drives their own theme.
 *
 * See DESIGN_SYSTEM.md for the token contract.
 */
export type ThemeVars = Record<string, string>;
export type ThemePref = "auto" | "light" | "dark";

const isDarkTime = (t: TimeOfDay) => t === "night" || t === "lateNight";

/** Resolve whether to render dark, from the user's preference + time of day. */
export function resolveDark(pref: ThemePref, timeOfDay: TimeOfDay): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return isDarkTime(timeOfDay);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hsl = (h: number, s: number, l: number) =>
  `${Math.round(h)} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;

export function computeTheme(mood: MoodSnapshot, timeOfDay: TimeOfDay, dark = isDarkTime(timeOfDay)): ThemeVars {

  // Warmth/saturation modulation from mood (happy + affectionate = warmer).
  const warmth =
    1 + (mood.happiness - 0.5) * 0.45 + (mood.affection - 0.5) * 0.3 - mood.annoyance * 0.6;
  const sat = (base: number) => clamp(base * warmth, 6, 92);

  // Mood-driven accent (her green eyes): cooler + duller when annoyed,
  // richer + brighter when affectionate.
  const accentHue = 142 + mood.annoyance * 20 - mood.affection * 6; // 122..165
  const accentSat = clamp(46 + mood.affection * 18 - mood.annoyance * 30, 12, 70);

  // A touch dimmer/desaturated when upset.
  const annoyDim = mood.annoyance * 6;

  if (dark) {
    return {
      "--bg": hsl(14, sat(22), 9 - annoyDim * 0.25),
      "--surface": hsl(15, sat(20), 13),
      "--elevated": hsl(16, sat(20), 17),
      "--overlay": hsl(10, 30, 4),
      "--ink": hsl(24, sat(28), 93),
      "--muted": hsl(18, sat(14), 66),
      "--faint": hsl(18, sat(12), 50),
      "--on-accent": hsl(14, 40, 12),
      "--amber": hsl(9, sat(60), 58),
      "--gold": hsl(20, sat(66), 62),
      "--brown": hsl(12, sat(34), 30),
      "--cream": hsl(22, sat(40), 88),
      "--accent": hsl(accentHue, accentSat, 56),
      "--accent-soft": hsl(accentHue, clamp(accentSat - 8, 10, 60), 22),
      "--border": hsl(15, sat(18), 24),
      "--border-strong": hsl(15, sat(16), 33),
      "--ring": hsl(accentHue, accentSat, 56),
      "--danger": hsl(2, 64, 62),
      "--danger-soft": hsl(2, 48, 22),
      "--success": hsl(146, 44, 56),
      "--success-soft": hsl(146, 34, 20),
      "--shadow": hsl(8, 55, 2),
    };
  }

  // Daytime (slightly warmer/rosier in the evening, brightest in the morning).
  const eveningWarm = timeOfDay === "evening" ? 3 : 0;
  return {
    "--bg": hsl(22 - eveningWarm, sat(26), 96 - annoyDim),
    "--surface": hsl(20 - eveningWarm, sat(24), 93),
    "--elevated": hsl(18, sat(22), 88),
    "--overlay": hsl(12, 34, 16),
    "--ink": hsl(14, sat(26), 18),
    "--muted": hsl(16, sat(14), 42),
    "--faint": hsl(18, sat(12), 58),
    "--on-accent": hsl(14, 40, 14),
    "--amber": hsl(9, sat(64), 55),
    "--gold": hsl(20, sat(70), 60),
    "--brown": hsl(12, sat(40), 32),
    "--cream": hsl(22, sat(42), 94),
    "--accent": hsl(accentHue, accentSat, 38),
    "--accent-soft": hsl(accentHue, clamp(accentSat - 4, 12, 60), 91),
    "--border": hsl(18, sat(20), 83),
    "--border-strong": hsl(16, sat(18), 72),
    "--ring": hsl(accentHue, accentSat, 46),
    "--danger": hsl(2, 72, 47),
    "--danger-soft": hsl(4, 72, 93),
    "--success": hsl(146, 46, 36),
    "--success-soft": hsl(146, 44, 91),
    "--shadow": hsl(12, 40, 22),
  };
}

/** Serialize theme vars into an inline style string for SSR injection on <html>. */
export function themeToStyle(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** The browser theme-color (mobile status bar / PWA) for the current theme. */
export function themeColor(vars: ThemeVars): string {
  return `hsl(${vars["--bg"]})`;
}
