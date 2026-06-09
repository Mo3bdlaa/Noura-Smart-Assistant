/** Prebuilt Gemini TTS voices offered in the profile (name must match Google's). */
export type GeminiVoice = { name: string; ar: string; en: string };

export const GEMINI_VOICE_OPTIONS: GeminiVoice[] = [
  { name: "Aoede", ar: "دافئ وهادئ", en: "warm & breezy" },
  { name: "Leda", ar: "شبابي وخفيف", en: "youthful" },
  { name: "Callirrhoe", ar: "مرتاح وسلس", en: "easy-going" },
  { name: "Kore", ar: "واثق وحازم", en: "firm" },
  { name: "Despina", ar: "ناعم", en: "smooth" },
  { name: "Erinome", ar: "واضح وهادئ", en: "clear" },
  { name: "Autonoe", ar: "مشرق", en: "bright" },
  { name: "Laomedeia", ar: "مرح وحيوي", en: "upbeat" },
  { name: "Achernar", ar: "رقيق", en: "soft" },
  { name: "Sulafat", ar: "دافئ وحنون", en: "warm" },
  { name: "Vindemiatrix", ar: "لطيف", en: "gentle" },
  { name: "Gacrux", ar: "ناضج", en: "mature" },
  { name: "Pulcherrima", ar: "جريء وصريح", en: "forward" },
  { name: "Zephyr", ar: "مشرق وحيوي", en: "bright & lively" },
];

export const GEMINI_VOICE_NAMES = new Set(GEMINI_VOICE_OPTIONS.map((v) => v.name));
export const DEFAULT_GEMINI_VOICE = "Aoede";
