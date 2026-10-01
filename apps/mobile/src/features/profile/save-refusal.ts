/**
 * Why a profile save was refused, in words, and which field it is about (`PUT /v1/profile` error codes, S12b.2). A
 * cancelled passkey prompt is not a refusal: it returns nothing and the form stays as it was.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { ApiError } from "@senryo/api-client";

export interface SaveRefusal {
  field: "username" | "name" | "bio" | "page";
  message: string;
}

/** `renaming` — the save changed the username, so a rate limit is the handle-change budget, not a busy server. */
export function saveRefusal(error: unknown, renaming: boolean): SaveRefusal | undefined {
  if (!(error instanceof ApiError)) {
    if (isSilent(classifyAuthError(error))) return undefined;
    return { field: "page", message: "Couldn’t save your profile. Check your connection and try again." };
  }
  switch (error.code) {
    case "HANDLE_TAKEN":
      return { field: "username", message: "Someone just took that name. Try another." };
    case "HANDLE_HELD":
      return { field: "username", message: "That name is on hold for its last owner. Try another." };
    case "HANDLE_RESERVED":
      return { field: "username", message: "That name is reserved" };
    case "HANDLE_INVALID":
      return { field: "username", message: "That name can’t be used" };
    case "RATE_LIMITED":
      return renaming
        ? { field: "username", message: "Too many username changes. Keep this one for now and try later." }
        : { field: "page", message: "Too many saves in a row. Try again in a moment." };
    case "CONTENT_BLOCKED": {
      const field = (error.details as { field?: unknown } | undefined)?.field;
      if (field === "displayName") return { field: "name", message: "That display name can’t be used" };
      if (field === "bio") return { field: "bio", message: "That bio can’t be saved. Try other words." };
      return { field: "page", message: "Some of that text can’t be saved. Try other words." };
    }
    default:
      return { field: "page", message: "Couldn’t save your profile. Try again." };
  }
}
