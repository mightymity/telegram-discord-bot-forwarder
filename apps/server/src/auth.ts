import bcrypt from "bcryptjs";
import { prisma } from "./db/prisma";
import { config } from "./config";

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Create the initial admin account from env on first boot (idempotent).
export async function ensureAdminUser(): Promise<void> {
  const existing = await prisma.adminUser.count();
  if (existing > 0) return;
  const passwordHash = await hashPassword(config.ADMIN_PASSWORD);
  await prisma.adminUser.create({
    data: { username: config.ADMIN_USERNAME, passwordHash },
  });
}
