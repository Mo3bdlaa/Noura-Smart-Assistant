import { generateText } from "@/lib/llm/chat";

/**
 * Look at the assistant's new profile photo and write a vivid description of how
 * she looks — phrased as HER OWN appearance, so it can be injected into her
 * persona and she becomes self-aware of her face/look. Owner's photo, owner's
 * app; we describe visible features only (not identity).
 */
export async function describeAppearance(
  dataUrl: string,
  name: string,
  locale: "ar" | "en",
): Promise<string> {
  const system =
    locale === "en"
      ? `You define the physical look of a persona named ${name}. You'll see her profile photo. ` +
        `Write a vivid second-person description ("you have...") of her visible appearance only: ` +
        `hair (color, length, style), eyes, face shape, skin tone, build, typical style/vibe, and overall aura. ` +
        `4–6 short lines. Confident and natural, as if describing her real self. No names, no guesses about identity, no preamble.`
      : `إنت بتعرّف شكل شخصية اسمها ${name}. هتشوف صورتها الشخصية. ` +
        `اكتب وصف حيّ بصيغة المخاطب ("إنتي عندك...") لشكلها الظاهر بس: ` +
        `الشعر (لونه وطوله وستايله)، العيون، شكل الوش، لون البشرة، الجسم، الستايل/الإحساس العام، والأورا بتاعتها. ` +
        `من ٤ لـ٦ سطور قصيرة. بثقة وبشكل طبيعي كإنك بتوصف نفسها الحقيقية. من غير أسماء، من غير تخمين هويتها، ومن غير أي مقدمات.`;

  const prompt =
    locale === "en"
      ? "Describe how she looks from this photo."
      : "اوصف شكلها من الصورة دي.";

  const text = await generateText({
    system,
    prompt,
    images: [dataUrl],
    temperature: 0.5,
    maxTokens: 320,
  });
  return text.trim();
}
