/**
 * The name "Noura" is reserved for the admin's assistant only. We normalize the
 * candidate (trim, lowercase, strip Arabic diacritics) and block a small set of
 * transliteration/spelling variants for non-admin users.
 */
const RESERVED = new Set(["نورا", "نوره", "نورة", "noura", "nora", "noora", "noura"]);

/** Strip Arabic diacritics (tashkeel) and tatweel, lowercase, collapse spaces. */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[ً-ْٰـ]/g, "") // harakat + tatweel
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isReservedName(raw: string): boolean {
  return RESERVED.has(normalizeName(raw));
}

/**
 * Validate an assistant name for a given role.
 * Returns an error message (Arabic) if invalid, or null if OK.
 */
export function validateAssistantName(raw: string, role: "admin" | "user"): string | null {
  const name = raw.trim();
  if (name.length < 2) return "الاسم قصير أوي، اختار اسم أطول شوية.";
  if (name.length > 40) return "الاسم طويل أوي.";
  if (isReservedName(name) && role !== "admin") {
    return 'اسم "نورا" محجوز 😏 اختار اسم تاني لمساعدك.';
  }
  return null;
}
