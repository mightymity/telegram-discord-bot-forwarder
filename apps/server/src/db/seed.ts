import { ensureAdminUser } from "../auth";
import { prisma } from "./prisma";

async function main(): Promise<void> {
  await ensureAdminUser();
  // eslint-disable-next-line no-console
  console.log("Seed complete: admin user ensured.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
