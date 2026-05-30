// Telegram (MTProto) error strings that mean the StringSession itself is no
// longer usable: the auth key was revoked, expired, or the account was logged
// out / deactivated. These are NOT recoverable by reconnecting — the operator
// must mint a new session via `npm run telegram:login`.
const SESSION_DEAD_PATTERNS = [
  "AUTH_KEY_UNREGISTERED",
  "AUTH_KEY_INVALID",
  "AUTH_KEY_DUPLICATED",
  "SESSION_REVOKED",
  "SESSION_EXPIRED",
  "USER_DEACTIVATED",
  "USER_DEACTIVATED_BAN",
];

// True when the error signals a dead session (vs. a transient network/flood
// error that GramJS can recover from by reconnecting). Matches on the GramJS
// `RPCError.errorMessage` as well as the generic message text so it stays
// robust across library versions and error shapes.
export function isSessionInvalidError(err: unknown): boolean {
  const e = err as { errorMessage?: unknown; message?: unknown } | null;
  const haystack = [
    typeof e?.errorMessage === "string" ? e.errorMessage : "",
    typeof e?.message === "string" ? e.message : "",
    String(err),
  ]
    .join(" ")
    .toUpperCase();
  return SESSION_DEAD_PATTERNS.some((pattern) => haystack.includes(pattern));
}
