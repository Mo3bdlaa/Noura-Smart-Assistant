import { db } from "@/lib/db/client";
import { assistants, conversations, moodState, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { validateAssistantName } from "./naming";

export type ProvisionInput = {
  email: string;
  password: string;
  role?: "admin" | "user";
  assistantName: string;
  displayName?: string;
  timezone?: string;
};

export type ProvisionResult = {
  userId: string;
  assistantId: string;
  mainConversationId: string;
};

/**
 * Create a user + their single assistant + the main conversation + baseline mood,
 * all in one transaction. Enforces the reserved-name rule.
 */
export async function provisionUser(input: ProvisionInput): Promise<ProvisionResult> {
  const role = input.role ?? "user";
  const nameError = validateAssistantName(input.assistantName, role);
  if (nameError) throw new ProvisionError(nameError);

  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email.toLowerCase().trim(),
          passwordHash,
          role,
          displayName: input.displayName ?? null,
          timezone: input.timezone ?? "Africa/Cairo",
        })
        .returning({ id: users.id });

      const [assistant] = await tx
        .insert(assistants)
        .values({ userId: user!.id, name: input.assistantName.trim() })
        .returning({ id: assistants.id });

      const [main] = await tx
        .insert(conversations)
        .values({
          userId: user!.id,
          assistantId: assistant!.id,
          type: "main",
          title: "الرئيسية",
        })
        .returning({ id: conversations.id });

      await tx.insert(moodState).values({ assistantId: assistant!.id });

      return { userId: user!.id, assistantId: assistant!.id, mainConversationId: main!.id };
    });
  } catch (err) {
    const msg = String((err as Error)?.message ?? "");
    if (/unique|duplicate/i.test(msg)) {
      if (/email/i.test(msg)) throw new ProvisionError("الإيميل ده مستخدم بالفعل.");
      if (/reserved_name/i.test(msg)) throw new ProvisionError('اسم "نورا" محجوز بالفعل.');
      throw new ProvisionError("في تعارض في البيانات، جرّب تاني.");
    }
    throw err;
  }
}

export class ProvisionError extends Error {}
