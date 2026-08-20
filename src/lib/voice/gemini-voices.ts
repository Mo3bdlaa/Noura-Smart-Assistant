/** Prebuilt Gemini TTS voices offered in the profile (name must match Google's). */
export type VoiceGender = "female" | "male";
export type GeminiVoice = { name: string; ar: string; en: string; gender: VoiceGender };

export const GEMINI_VOICE_OPTIONS: GeminiVoice[] = [
  // female-leaning
  { name: "Aoede", ar: "دافئ وهادئ", en: "warm & breezy", gender: "female" },
  { name: "Leda", ar: "شبابي وخفيف", en: "youthful", gender: "female" },
  { name: "Callirrhoe", ar: "مرتاح وسلس", en: "easy-going", gender: "female" },
  { name: "Kore", ar: "واثق وحازم", en: "firm", gender: "female" },
  { name: "Despina", ar: "ناعم", en: "smooth", gender: "female" },
  { name: "Erinome", ar: "واضح وهادئ", en: "clear", gender: "female" },
  { name: "Autonoe", ar: "مشرق", en: "bright", gender: "female" },
  { name: "Laomedeia", ar: "مرح وحيوي", en: "upbeat", gender: "female" },
  { name: "Achernar", ar: "رقيق", en: "soft", gender: "female" },
  { name: "Sulafat", ar: "دافئ وحنون", en: "warm", gender: "female" },
  { name: "Vindemiatrix", ar: "لطيف", en: "gentle", gender: "female" },
  { name: "Gacrux", ar: "ناضج", en: "mature", gender: "female" },
  { name: "Pulcherrima", ar: "جريء وصريح", en: "forward", gender: "female" },
  { name: "Zephyr", ar: "مشرق وحيوي", en: "bright & lively", gender: "female" },
  // male-leaning
  { name: "Orus", ar: "واثق وحازم", en: "firm", gender: "male" },
  { name: "Puck", ar: "مرح وحيوي", en: "upbeat", gender: "male" },
  { name: "Charon", ar: "هادئ ومطمئن", en: "informative", gender: "male" },
  { name: "Fenrir", ar: "متحمّس وقوي", en: "excitable", gender: "male" },
  { name: "Enceladus", ar: "هامس وهادي", en: "breathy", gender: "male" },
  { name: "Iapetus", ar: "واضح", en: "clear", gender: "male" },
  { name: "Umbriel", ar: "مرتاح", en: "easy-going", gender: "male" },
  { name: "Algieba", ar: "ناعم", en: "smooth", gender: "male" },
  { name: "Algenib", ar: "خشن ودافي", en: "gravelly", gender: "male" },
  { name: "Rasalgethi", ar: "معلوماتي", en: "informative", gender: "male" },
  { name: "Alnilam", ar: "حازم", en: "firm", gender: "male" },
  { name: "Schedar", ar: "متزن", en: "even", gender: "male" },
  { name: "Achird", ar: "ودود", en: "friendly", gender: "male" },
  { name: "Sadaltager", ar: "عارف وواثق", en: "knowledgeable", gender: "male" },
];

export const GEMINI_VOICE_NAMES = new Set(GEMINI_VOICE_OPTIONS.map((v) => v.name));

export const DEFAULT_GEMINI_VOICE = "Aoede";
/** Deeper default so a male assistant doesn't speak with a female-leaning voice. */
export const DEFAULT_GEMINI_VOICE_MALE = "Orus";

export const defaultVoiceFor = (gender?: string | null): string =>
  gender === "male" ? DEFAULT_GEMINI_VOICE_MALE : DEFAULT_GEMINI_VOICE;

/** Voices to offer for an assistant of this gender (falls back to all). */
export const voicesFor = (gender?: string | null): GeminiVoice[] => {
  const g: VoiceGender = gender === "male" ? "male" : "female";
  const list = GEMINI_VOICE_OPTIONS.filter((v) => v.gender === g);
  return list.length ? list : GEMINI_VOICE_OPTIONS;
};
