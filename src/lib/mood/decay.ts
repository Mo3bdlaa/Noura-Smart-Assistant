import type { MoodState } from "@/lib/db/schema";

export const MOOD_BASELINE = {
  happiness: 0.6,
  affection: 0.55,
  annoyance: 0.0,
  energy: 0.6,
} as const;

export type MoodDimensions = {
  happiness: number;
  affection: number;
  annoyance: number;
  energy: number;
  intensity: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Decay mood toward baseline based on elapsed minutes. Annoyance/intensity fade a
 * touch slower than happiness/energy (a real feeling needs a moment to settle), but
 * NOT for hours — she's secure and doesn't nurse grudges. A short cooldown and
 * she's back to herself.
 */
export function decayMood(state: MoodState, now: Date): MoodDimensions {
  const elapsedMin = Math.max(0, (now.getTime() - state.lastUpdatedAt.getTime()) / 60000);

  // half-lives in minutes
  const fastHalf = 75; // happiness/affection/energy back to baseline
  // even a genuine upset mostly fades within an hour or two — gentle, not dramatic.
  const conflictHalf = 70 + state.intensity * 120; // ~70min .. ~3.2h at most
  const fast = Math.pow(0.5, elapsedMin / fastHalf);
  const slow = Math.pow(0.5, elapsedMin / conflictHalf);

  const toward = (cur: number, base: number, k: number) => base + (cur - base) * k;

  return {
    happiness: clamp01(toward(state.happiness, MOOD_BASELINE.happiness, fast)),
    affection: clamp01(toward(state.affection, MOOD_BASELINE.affection, fast)),
    energy: clamp01(toward(state.energy, MOOD_BASELINE.energy, fast)),
    annoyance: clamp01(toward(state.annoyance, MOOD_BASELINE.annoyance, slow)),
    intensity: clamp01(state.intensity * slow),
  };
}
