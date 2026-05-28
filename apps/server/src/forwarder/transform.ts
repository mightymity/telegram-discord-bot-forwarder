// Converts Telegram message text + entities into Discord-flavored markdown.
// Telegram entity offsets/lengths are in UTF-16 code units, which matches how
// JavaScript indexes strings — so slice/index math lines up directly.

export interface TgEntity {
  className: string;
  offset: number;
  length: number;
  url?: string;
  language?: string;
}

interface Token {
  open: string;
  close: string;
}

const DISCORD_MESSAGE_LIMIT = 2000;

function mapEntity(e: TgEntity): Token | null {
  switch (e.className) {
    case "MessageEntityBold":
      return { open: "**", close: "**" };
    case "MessageEntityItalic":
      return { open: "*", close: "*" };
    case "MessageEntityUnderline":
      return { open: "__", close: "__" };
    case "MessageEntityStrike":
    case "MessageEntityStrikethrough":
      return { open: "~~", close: "~~" };
    case "MessageEntitySpoiler":
      return { open: "||", close: "||" };
    case "MessageEntityCode":
      return { open: "`", close: "`" };
    case "MessageEntityPre":
      return { open: "```" + (e.language ? e.language + "\n" : "\n"), close: "\n```" };
    case "MessageEntityTextUrl":
      return { open: "[", close: `](${e.url ?? ""})` };
    default:
      // Plain urls, mentions, hashtags, etc. are left as-is (Discord handles them).
      return null;
  }
}

export function telegramToDiscordMarkdown(
  text: string,
  entities: readonly TgEntity[] | undefined | null,
): string {
  if (!text) return "";
  if (!entities || entities.length === 0) return text;

  // Outer entities first so nesting wraps correctly.
  const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length);

  const opensAt = new Map<number, string[]>();
  const closesAt = new Map<number, string[]>();

  for (const e of sorted) {
    const token = mapEntity(e);
    if (!token) continue;
    const start = e.offset;
    const end = e.offset + e.length;
    if (start < 0 || end > text.length || end < start) continue;

    const opens = opensAt.get(start) ?? [];
    opens.push(token.open);
    opensAt.set(start, opens);

    // Inner entities close before outer ones at the same boundary.
    const closes = closesAt.get(end) ?? [];
    closes.unshift(token.close);
    closesAt.set(end, closes);
  }

  let out = "";
  for (let i = 0; i <= text.length; i++) {
    for (const c of closesAt.get(i) ?? []) out += c;
    if (i < text.length) {
      for (const o of opensAt.get(i) ?? []) out += o;
      out += text[i];
    }
  }
  return out;
}

// Split into Discord-sized chunks, preferring newline then space boundaries.
export function splitMessage(text: string, max = DISCORD_MESSAGE_LIMIT): string[] {
  if (text.length <= max) return text.length ? [text] : [];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = remaining.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\s+/, "");
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

export { DISCORD_MESSAGE_LIMIT };
