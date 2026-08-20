import type { AssembleInput } from "./assemble";
import type { Archetype, Gender, PersonaDials } from "./definition";
import type { LangCode } from "./languages";
import type { CanonEntry } from "@/lib/db/schema";

/** The assistant columns every persona build needs. */
export type AssistantIdentity = {
  name: string;
  persona: unknown;
  canon: unknown;
  appearance: string | null;
  language: string;
  archetype: string;
  gender: string;
};

/**
 * Single source of truth for "who she is" when building a system prompt.
 *
 * Every generator (chat, regenerate, scheduled tasks, outreach, dreams, diary)
 * MUST build its prompt from this — otherwise a caller silently falls back to the
 * defaults (female / companion / Egyptian) and the assistant becomes a different
 * character in that surface, which is exactly the bug this module exists to stop.
 */
export function personaIdentity(a: AssistantIdentity): {
  assistantName: string;
  archetype: Archetype;
  gender: Gender;
  language: LangCode;
  dials: PersonaDials;
  canon: CanonEntry[];
  appearance: string | null;
} {
  return {
    assistantName: a.name,
    archetype: (a.archetype as Archetype) ?? "companion",
    gender: (a.gender as Gender) ?? "female",
    language: (a.language as LangCode) ?? "en",
    dials: (a.persona as PersonaDials) ?? {},
    canon: (a.canon as CanonEntry[]) ?? [],
    appearance: a.appearance ?? null,
  };
}

/** Build a complete AssembleInput from an assistant row + the turn-specific parts. */
export function personaInput(
  a: AssistantIdentity,
  rest: Omit<
    AssembleInput,
    "assistantName" | "archetype" | "gender" | "language" | "dials" | "canon" | "appearance"
  >,
): AssembleInput {
  return { ...personaIdentity(a), ...rest };
}
