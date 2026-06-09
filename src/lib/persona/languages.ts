/** Her speaking language/dialect — independent of the app UI locale. */
export type LangCode =
  | "en"
  | "masri"
  | "levantine"
  | "khaliji"
  | "maghrebi"
  | "msa"
  | "fr"
  | "auto";

export const DEFAULT_LANGUAGE: LangCode = "en";

export const LANGUAGE_OPTIONS: { code: LangCode; ar: string; en: string }[] = [
  { code: "en", ar: "إنجليزي", en: "English" },
  { code: "masri", ar: "مصري", en: "Egyptian Arabic" },
  { code: "levantine", ar: "شامي", en: "Levantine Arabic" },
  { code: "khaliji", ar: "خليجي", en: "Gulf Arabic" },
  { code: "maghrebi", ar: "مغربي (دارجة)", en: "Maghrebi Arabic" },
  { code: "msa", ar: "فصحى", en: "Modern Standard Arabic" },
  { code: "fr", ar: "فرنساوي", en: "French" },
  { code: "auto", ar: "تلقائي (يطابق لغة المستخدم)", en: "Auto (match the user)" },
];

const NAMES = new Set(LANGUAGE_OPTIONS.map((o) => o.code));
export const isLang = (v: unknown): v is LangCode => typeof v === "string" && NAMES.has(v as LangCode);

/** A strong output-language directive injected into the system prompt. */
export function languageDirective(code: LangCode): string {
  switch (code) {
    case "en":
      return "OUTPUT LANGUAGE: Reply only in natural, warm, everyday English — same personality, feelings and intimacy. Don't use Arabic unless the user writes in Arabic first.";
    case "masri":
      return "اللغة: ردّي بالعامية المصرية الطبيعية، بنفس الشخصية بالظبط.";
    case "levantine":
      return "اللغة: ردّي باللهجة الشامية الطبيعية (سوري/لبناني/فلسطيني)، بنفس الشخصية الدافية.";
    case "khaliji":
      return "اللغة: ردّي باللهجة الخليجية الطبيعية، بنفس الشخصية الدافية.";
    case "maghrebi":
      return "اللغة: ردّي بالدارجة المغاربية الطبيعية، بنفس الشخصية الدافية.";
    case "msa":
      return "اللغة: ردّي بالعربية الفصحى المبسّطة والدافية، بنفس الشخصية.";
    case "fr":
      return "LANGUE: Réponds uniquement en français naturel et chaleureux — même personnalité, mêmes émotions.";
    case "auto":
      return "OUTPUT LANGUAGE: Detect the user's language AND dialect from their messages and mirror it exactly (Egyptian, Levantine, Gulf, Maghrebi, MSA, English, French, …), with the same personality, and stay consistent.";
  }
}
