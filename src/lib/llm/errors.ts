/** Detect provider rate-limit / quota-exhausted errors. */
export function isQuotaError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const msg = String((e as Error)?.message ?? "");
  return status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
}

/** A short, user-facing message for a failed model call (locale-aware). */
export function friendlyError(e: unknown, locale: "ar" | "en"): string {
  if (isQuotaError(e)) {
    return locale === "en"
      ? "🕊️ The model hit its free-tier limit right now. Wait a minute and try again — or enable billing on the API key."
      : "🕊️ الموديل وصل حده المجاني دلوقتي. استنى دقيقة وجرّب تاني — أو فعّل الفوترة على المفتاح.";
  }
  return locale === "en"
    ? "⚠️ Something glitched — tap regenerate to retry."
    : "⚠️ حصلت لخبطة بسيطة — اضغط زرار الإعادة 🔄";
}
