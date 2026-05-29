import type { MoodSnapshot } from "@/lib/mood/state";
import type { TimeOfDay } from "@/lib/time/awareness";

/**
 * Compute the live theme as CSS custom properties (HSL component strings used by
 * `hsl(var(--token))` in Tailwind). The palette is Noura's warm golden-hour
 * identity; it warms up when she's happy/affectionate, desaturates + cools when
 * she's annoyed, and goes dark & cozy at night.
 */
export type ThemeVars = Record<string, string>;

const isDarkTime = (t: TimeOfDay) => t === "night" || t === "lateNight";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hsl = (h: number, s: number, l: number) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;

export function computeTheme(mood: MoodSnapshot, timeOfDay: TimeOfDay): ThemeVars {
  const dark = isDarkTime(timeOfDay);

  // warmth/saturation modulation from mood
  const warmth =
    1 + (mood.happiness - 0.5) * 0.5 + (mood.affection - 0.5) * 0.3 - mood.annoyance * 0.7;
  const sat = (base: number) => clamp(base * warmth, 8, 90);

  // a touch dimmer/desaturated when upset
  const annoyDim = mood.annoyance * 6;

  if (dark) {
    return {
      "--bg": hsl(26, sat(28), 9 - annoyDim * 0.3),
      "--surface": hsl(27, sat(26), 13),
      "--elevated": hsl(28, sat(24), 17),
      "--ink": hsl(40, sat(38), 92),
      "--muted": hsl(35, sat(18), 64),
      "--amber": hsl(34, sat(70), 58),
      "--gold": hsl(45, sat(72), 60),
      "--brown": hsl(25, sat(40), 26),
      "--cream": hsl(40, sat(45), 88),
      "--accent": hsl(142, sat(40), 52),
      "--border": hsl(28, sat(22), 24),
    };
  }

  // daytime (warmer in evening, brightest in morning)
  const eveningWarm = timeOfDay === "evening" ? 4 : 0;
  return {
    "--bg": hsl(40 - eveningWarm, sat(48), 96 - annoyDim),
    "--surface": hsl(38 - eveningWarm, sat(44), 92),
    "--elevated": hsl(36, sat(40), 87),
    "--ink": hsl(25, sat(34), 18),
    "--muted": hsl(30, sat(20), 44),
    "--amber": hsl(34, sat(78), 52),
    "--gold": hsl(45, sat(80), 50),
    "--brown": hsl(25, sat(45), 30),
    "--cream": hsl(40, sat(50), 94),
    "--accent": hsl(142, sat(45), 40),
    "--border": hsl(35, sat(30), 82),
  };
}

/** Serialize theme vars into an inline style string for SSR injection on <html>. */
export function themeToStyle(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
