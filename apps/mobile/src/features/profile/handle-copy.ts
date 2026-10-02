/**
 * What a typed username's check says (A2 states table; defect 7): every server state gets its own words — taken,
 * reserved (Senryo, partners, roles), on hold (released < 30 days ago), not allowed (a blocked word) — so a reserved
 * name never reads "taken". Short lines: the reason behind "On hold" lives in an ⓘ.
 */
import { HANDLE_MAX_CHARS, HANDLE_MIN_CHARS, type HandleAvailability } from "@senryo/api-client";

export type HandleTone = "quiet" | "good" | "bad";

const INVALID: Record<NonNullable<HandleAvailability["reason"]>, string> = {
  length: `${HANDLE_MIN_CHARS}–${HANDLE_MAX_CHARS} characters`,
  charset: "Letters, numbers, _ only",
  blocked: "Not allowed",
};

export const HELD_INFO = {
  title: "On hold",
  body: "This name was released less than 30 days ago. Only its last owner can take it back until then.",
} as const;

export function handleLine(known: HandleAvailability): { message: string; tone: HandleTone } {
  switch (known.state) {
    case "available":
      return { message: `@${known.handle} is available`, tone: "good" };
    case "taken":
      return { message: "Taken", tone: "bad" };
    case "reserved":
      return { message: "Reserved", tone: "bad" };
    case "held":
      return { message: "On hold", tone: "bad" };
    case "invalid":
      return { message: INVALID[known.reason ?? "charset"], tone: "bad" };
  }
}
