/**
 * Optional lead tags the model may emit at the very start of a reply:
 *   <react:❤️>            → react to the user's message
 *   <replyto:جزء من كلامه> → quote-reply to a specific earlier user message
 *   <photo> / <photo:mood> → send one of her photos (optionally matching a mood/scene)
 * Any, all, or none. The chat route strips them and turns them into UI behaviors.
 */
export const REACT_LEAD_RE = /^\s*<react:\s*([^\s>]{1,16})\s*>\s*/u;
export const REPLY_LEAD_RE = /^\s*<replyto:\s*([^>]{1,80}?)\s*>\s*/u;
export const PHOTO_LEAD_RE = /^\s*<photo(?::\s*([^>]{0,40}?))?\s*>\s*/u;
export const VOICE_LEAD_RE = /^\s*<voice>\s*/u;

/** NUL-prefixed control frame the chat stream sends before the reply text. */
export const CONTROL_PREFIX = String.fromCharCode(0);
export const controlFrame = (obj: Record<string, unknown>) =>
  `${CONTROL_PREFIX}${JSON.stringify(obj)}\n`;

export type LeadTags = {
  reaction: string | null;
  replyQuote: string | null;
  photo: boolean;
  photoTag: string | null;
  voice: boolean;
  rest: string;
};

/** Strip any leading <react:>/<replyto:>/<photo:>/<voice> tags and return what they carried. */
export function parseLeadTags(text: string): LeadTags {
  let rest = text;
  let reaction: string | null = null;
  let replyQuote: string | null = null;
  let photo = false;
  let photoTag: string | null = null;
  let voice = false;
  for (let i = 0; i < 6; i++) {
    const r = rest.match(REACT_LEAD_RE);
    if (r) {
      if (!reaction) reaction = (r[1] ?? "").trim() || null;
      rest = rest.slice(r[0].length);
      continue;
    }
    const q = rest.match(REPLY_LEAD_RE);
    if (q) {
      if (!replyQuote) replyQuote = (q[1] ?? "").trim() || null;
      rest = rest.slice(q[0].length);
      continue;
    }
    const ph = rest.match(PHOTO_LEAD_RE);
    if (ph) {
      photo = true;
      if (!photoTag) photoTag = (ph[1] ?? "").trim() || null;
      rest = rest.slice(ph[0].length);
      continue;
    }
    const v = rest.match(VOICE_LEAD_RE);
    if (v) {
      voice = true;
      rest = rest.slice(v[0].length);
      continue;
    }
    break;
  }
  return { reaction, replyQuote, photo, photoTag, voice, rest };
}

/** While streaming, could this buffer still grow into a leading tag? */
export function couldBeLeadTag(buf: string): boolean {
  const s = buf.replace(/^\s+/, "");
  if (s === "") return true;
  for (const prefix of ["<react:", "<replyto:", "<photo", "<voice"]) {
    if (s.length < prefix.length) {
      if (prefix.startsWith(s)) return true;
    } else if (s.startsWith(prefix) && !s.includes(">")) {
      return true;
    }
  }
  return false;
}

