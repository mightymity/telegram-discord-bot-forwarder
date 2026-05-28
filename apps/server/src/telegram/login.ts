import "../lib/load-env";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { LogLevel } from "telegram/extensions/Logger";

// Standalone interactive login. Decoupled from the app config on purpose so it
// can run before the dashboard secrets are configured. Produces a StringSession
// to paste into .env as TELEGRAM_SESSION.
async function main(): Promise<void> {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    // eslint-disable-next-line no-console
    console.error(
      "Set TELEGRAM_API_ID and TELEGRAM_API_HASH in your .env first.\n" +
        "Get them from https://my.telegram.org -> API development tools.",
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  const ask = (q: string) => rl.question(q);

  const session = new StringSession(process.env.TELEGRAM_SESSION ?? "");
  const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
  client.setLogLevel(LogLevel.ERROR);

  await client.start({
    phoneNumber: async () => (await ask("Phone number (international, e.g. +66812345678): ")).trim(),
    password: async () => (await ask("2FA password (leave blank if none): ")).trim(),
    phoneCode: async () => (await ask("Login code (sent to you on Telegram): ")).trim(),
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("Login error:", err);
    },
  });

  const saved = client.session.save();
  rl.close();
  await client.disconnect();

  // eslint-disable-next-line no-console
  console.log(
    `\n==================== TELEGRAM_SESSION ====================\n\n${saved}\n\n` +
      "Copy the line above into your .env file:\n  TELEGRAM_SESSION=<that value>\n" +
      "Keep it secret — it grants full access to your Telegram account.\n",
  );
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
