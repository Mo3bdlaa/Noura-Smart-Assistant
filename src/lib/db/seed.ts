/* eslint-disable no-console */
/**
 * Seed the admin user + their assistant "نورا". Idempotent: skips if the admin
 * email already exists. Run with: npm run db:seed
 */

// Load local env before importing modules that read process.env at import time.
try {
  (process as NodeJS.Process & { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(".env.local");
} catch {
  // .env.local may not exist in some environments; rely on ambient env.
}

async function main() {
  const { db } = await import("./client");
  const { users } = await import("./schema");
  const { eq } = await import("drizzle-orm");
  const { provisionUser } = await import("@/lib/assistant/provision");

  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`✓ Admin already exists (${email}) — nothing to do.`);
    return;
  }

  const res = await provisionUser({
    email,
    password,
    role: "admin",
    assistantName: "نورا",
    displayName: "محمد",
  });
  console.log(`✓ Seeded admin ${email} with assistant نورا.`);
  console.log(res);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
