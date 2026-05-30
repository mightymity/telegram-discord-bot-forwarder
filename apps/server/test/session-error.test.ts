import { describe, it, expect } from "vitest";
import { isSessionInvalidError } from "../src/telegram/session-errors";

describe("isSessionInvalidError", () => {
  it("flags revoked / expired / deactivated sessions", () => {
    for (const msg of [
      "RPCError 401: AUTH_KEY_UNREGISTERED (caused by ...)",
      "SESSION_REVOKED",
      "rpc error: SESSION_EXPIRED",
      "USER_DEACTIVATED_BAN",
      "AUTH_KEY_DUPLICATED",
      "AUTH_KEY_INVALID",
    ]) {
      expect(isSessionInvalidError(new Error(msg))).toBe(true);
    }
  });

  it("reads GramJS RPCError.errorMessage", () => {
    expect(isSessionInvalidError({ code: 401, errorMessage: "AUTH_KEY_UNREGISTERED" })).toBe(true);
  });

  it("does not flag transient / network / flood errors", () => {
    for (const msg of [
      "ECONNRESET",
      "TIMEOUT",
      "FLOOD_WAIT_30",
      "Not connected",
      "socket hang up",
      "Disconnect (code 4)",
    ]) {
      expect(isSessionInvalidError(new Error(msg))).toBe(false);
    }
  });

  it("handles null / undefined / non-object inputs", () => {
    expect(isSessionInvalidError(null)).toBe(false);
    expect(isSessionInvalidError(undefined)).toBe(false);
    expect(isSessionInvalidError("just a string")).toBe(false);
  });
});
