import { describe, expect, it } from "vitest";
import {
  telegramToDiscordMarkdown,
  splitMessage,
  type TgEntity,
} from "../src/forwarder/transform";

const ent = (className: string, offset: number, length: number, extra: Partial<TgEntity> = {}): TgEntity => ({
  className,
  offset,
  length,
  ...extra,
});

describe("telegramToDiscordMarkdown", () => {
  it("returns text unchanged when there are no entities", () => {
    expect(telegramToDiscordMarkdown("hello world", [])).toBe("hello world");
    expect(telegramToDiscordMarkdown("hello", null)).toBe("hello");
  });

  it("returns empty string for empty text", () => {
    expect(telegramToDiscordMarkdown("", [ent("MessageEntityBold", 0, 0)])).toBe("");
  });

  it("wraps basic inline styles", () => {
    expect(telegramToDiscordMarkdown("Hello world", [ent("MessageEntityBold", 0, 5)])).toBe(
      "**Hello** world",
    );
    expect(telegramToDiscordMarkdown("Hello world", [ent("MessageEntityItalic", 6, 5)])).toBe(
      "Hello *world*",
    );
    expect(telegramToDiscordMarkdown("secret", [ent("MessageEntitySpoiler", 0, 6)])).toBe(
      "||secret||",
    );
    expect(telegramToDiscordMarkdown("gone", [ent("MessageEntityStrike", 0, 4)])).toBe("~~gone~~");
  });

  it("renders inline code and fenced pre blocks", () => {
    expect(telegramToDiscordMarkdown("npm i", [ent("MessageEntityCode", 0, 5)])).toBe("`npm i`");
    expect(telegramToDiscordMarkdown("code", [ent("MessageEntityPre", 0, 4)])).toBe(
      "```\ncode\n```",
    );
    expect(
      telegramToDiscordMarkdown("code", [ent("MessageEntityPre", 0, 4, { language: "js" })]),
    ).toBe("```js\ncode\n```");
  });

  it("renders text links with their URL", () => {
    expect(
      telegramToDiscordMarkdown("click here", [
        ent("MessageEntityTextUrl", 0, 10, { url: "https://example.com" }),
      ]),
    ).toBe("[click here](https://example.com)");
  });

  it("nests overlapping entities correctly (bold + italic)", () => {
    const result = telegramToDiscordMarkdown("abc", [
      ent("MessageEntityBold", 0, 3),
      ent("MessageEntityItalic", 0, 3),
    ]);
    expect(result).toBe("***abc***");
  });

  it("leaves unknown entity types as plain text", () => {
    expect(telegramToDiscordMarkdown("@user", [ent("MessageEntityMention", 0, 5)])).toBe("@user");
  });

  it("ignores entities that fall outside the text bounds", () => {
    expect(telegramToDiscordMarkdown("hi", [ent("MessageEntityBold", 0, 99)])).toBe("hi");
  });
});

describe("splitMessage", () => {
  it("returns a single chunk for short text", () => {
    expect(splitMessage("hello")).toEqual(["hello"]);
  });

  it("returns no chunks for empty text", () => {
    expect(splitMessage("")).toEqual([]);
  });

  it("hard-splits text with no whitespace boundary", () => {
    const chunks = splitMessage("a".repeat(2500), 2000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(2000);
    expect(chunks[1]).toHaveLength(500);
  });

  it("prefers splitting on a newline boundary", () => {
    const text = "x".repeat(1500) + "\n" + "y".repeat(1000);
    const chunks = splitMessage(text, 2000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe("x".repeat(1500));
    expect(chunks[1]).toBe("y".repeat(1000));
  });

  it("keeps every chunk within the limit", () => {
    const text = "word ".repeat(1000);
    for (const chunk of splitMessage(text, 2000)) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });
});
