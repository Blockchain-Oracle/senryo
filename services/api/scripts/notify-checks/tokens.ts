import { randomBytes } from "node:crypto";
import type { Harness, User } from "../social-harness.ts";

const TOKEN_BYTES = 8;

/** Registers a device for `u` the way `PUT /v1/push/token` stores it (defaults unless overridden); returns the token. */
export async function addToken(
  h: Harness,
  u: User,
  platform: "ios" | "android",
  channels: Partial<Record<"ch_fills" | "ch_social" | "ch_followed_trades", boolean>> = {},
): Promise<string> {
  const token = `ExponentPushToken[chk-${randomBytes(TOKEN_BYTES).toString("hex")}]`;
  await h.db`INSERT INTO push_tokens ${h.db({ token, user_address: u.lower, platform, kind: "expo", ...channels })}`;
  return token;
}
