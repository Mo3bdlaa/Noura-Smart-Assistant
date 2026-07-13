/**
 * Strip control tags (<voice>, <todo:…>, <note:…>, <done:…>, any variant/partial)
 * from text that is about to be shown or stored as a visible message. Used by the
 * chat stream AND every proactive path (task runs, outreach, deliveries) so a tag
 * can never leak to the user no matter which pipeline generated the text.
 */
const FULL_TAG_RE = /<\s*\/?\s*(?:voice|todo|note|done)\b[^>]*>/gi;
// a tag the model started but never closed at the very end of the text
const TRAILING_PARTIAL_RE = /<\s*\/?\s*(?:voice|todo|note|done)\b[^>]*$/i;

export function stripControlTags(text: string): string {
  return text.replace(FULL_TAG_RE, "").replace(TRAILING_PARTIAL_RE, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** Does the text carry a voice tag (before stripping)? */
export function hasVoiceTag(text: string): boolean {
  return /<\s*\/?\s*voice\s*\/?\s*>/i.test(text);
}
