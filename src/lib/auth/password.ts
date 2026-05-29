import { hash, verify } from "@node-rs/argon2";

/** Hash a plaintext password. @node-rs/argon2 defaults to argon2id. */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Verify a plaintext password against a stored argon2id hash. */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
