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

const isDarkTime = (t: TimeOfDay) => t === "night" || t === "lateNight";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hsl = (h: number, s: number, l: number) =>
  `${Math.round(h)} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;

export function computeTheme(mood: MoodSnapshot, timeOfDay: TimeOfDay): ThemeVars {
  const dark = isDarkTime(timeOfDay);

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
      "--bg": hsl(26, sat(26), 9 - annoyDim * 0.25),
      "--surface": hsl(27, sat(24), 13),
      "--elevated": hsl(28, sat(22), 17),
      "--overlay": hsl(26, 30, 4),
      "--ink": hsl(40, sat(34), 93),
      "--muted": hsl(35, sat(16), 66),
      "--faint": hsl(33, sat(12), 50),
      "--on-accent": hsl(30, 45, 12),
      "--amber": hsl(34, sat(68), 58),
      "--gold": hsl(45, sat(70), 60),
      "--brown": hsl(25, sat(36), 28),
      "--cream": hsl(40, sat(42), 88),
      "--accent": hsl(accentHue, accentSat, 56),
      "--accent-soft": hsl(accentHue, clamp(accentSat - 8, 10, 60), 22),
      "--border": hsl(28, sat(20), 24),
      "--border-strong": hsl(28, sat(18), 33),
      "--ring": hsl(accentHue, accentSat, 56),
      "--danger": hsl(6, 64, 62),
      "--danger-soft": hsl(6, 48, 22),
      "--success": hsl(146, 44, 56),
      "--success-soft": hsl(146, 34, 20),
      "--shadow": hsl(25, 55, 2),
    };
  }

  // Daytime (slightly warmer in the evening, brightest in the morning).
  const eveningWarm = timeOfDay === "evening" ? 4 : 0;
  return {
    "--bg": hsl(40 - eveningWarm, sat(46), 96 - annoyDim),
    "--surface": hsl(38 - eveningWarm, sat(42), 93),
    "--elevated": hsl(36, sat(38), 88),
    "--overlay": hsl(26, 38, 16),
    "--ink": hsl(25, sat(32), 17),
    "--muted": hsl(30, sat(16), 42),
    "--faint": hsl(32, sat(14), 58),
    "--on-accent": hsl(30, 45, 13),
    "--amber": hsl(34, sat(80), 52),
    "--gold": hsl(44, sat(82), 50),
    "--brown": hsl(25, sat(42), 30),
    "--cream": hsl(40, sat(50), 94),
    "--accent": hsl(accentHue, accentSat, 38),
    "--accent-soft": hsl(accentHue, clamp(accentSat - 4, 12, 60), 91),
    "--border": hsl(35, sat(26), 82),
    "--border-strong": hsl(34, sat(22), 71),
    "--ring": hsl(accentHue, accentSat, 46),
    "--danger": hsl(4, 70, 47),
    "--danger-soft": hsl(6, 72, 93),
    "--success": hsl(146, 46, 36),
    "--success-soft": hsl(146, 44, 91),
    "--shadow": hsl(25, 42, 22),
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
