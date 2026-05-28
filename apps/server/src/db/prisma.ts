import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "../config";

// Prisma 7 uses driver adapters at runtime instead of the bundled query engine.
const adapter = new PrismaBetterSqlite3({ url: config.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
