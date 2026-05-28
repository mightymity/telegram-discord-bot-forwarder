import type { Route } from "@prisma/client";
import { prisma } from "../db/prisma";

// All enabled routes whose source matches this Telegram chat id.
export function findRoutesForChat(chatId: string): Promise<Route[]> {
  return prisma.route.findMany({ where: { enabled: true, tgSourceId: chatId } });
}

function parseKeywords(csv: string | null): string[] {
  return (csv ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

// exclude wins over include; empty include list means "allow all".
export function passesKeywordFilters(
  text: string,
  route: Pick<Route, "includeKeywords" | "excludeKeywords">,
): boolean {
  const haystack = text.toLowerCase();
  const exclude = parseKeywords(route.excludeKeywords);
  if (exclude.some((k) => haystack.includes(k))) return false;

  const include = parseKeywords(route.includeKeywords);
  if (include.length > 0 && !include.some((k) => haystack.includes(k))) return false;

  return true;
}
