import { z } from "zod";
import { addressSchema, chainIdSchema, isoTimeSchema } from "../primitives.ts";
import {
  AVATAR_ID_PATTERN,
  BIO_MAX_CHARS,
  DISPLAY_NAME_MAX_CHARS,
  HANDLE_INPUT_MAX_CHARS,
  HANDLE_MAX_CHARS,
} from "../social.ts";
import { defineRoute } from "./define.ts";

/**
 * Handles and profiles (S12b.2, D-174). Privacy first: the passkey account has ONE address on both networks, so a
 * profile — handle included — is served for a network only when the owner listed it there. An unlisted profile and
 * no profile at all both answer 404, so a lookup never reveals whether an unlisted account exists.
 * Writes need a SIWE session for the same address; handle claims are single-flight under a case-insensitive unique
 * index, and a released handle is held for its previous owner for `HANDLE_TOMBSTONE_DAYS`.
 */

/** Control characters are never stored (a bio may keep line breaks). */
const NO_CONTROL = /^[^\p{Cc}]*$/u;
const NO_CONTROL_BUT_NEWLINE = /^(?:[^\p{Cc}]|\n)*$/u;

/**
 * `available` · `taken` (someone holds it) · `held` (released < 30 days ago; only the previous owner may reclaim it) ·
 * `reserved` (Senryo, partners, roles) · `invalid` (`reason`: length, charset or a blocked word).
 */
export const HANDLE_STATES = ["available", "taken", "held", "reserved", "invalid"] as const;
export const HANDLE_INVALID_REASONS = ["length", "charset", "blocked"] as const;

export const handleParamsSchema = z.object({ h: z.string().min(1).max(HANDLE_INPUT_MAX_CHARS) });

export const handleAvailabilitySchema = z.object({
  /** The normalised handle the state is about (`" @Abu_J"` → `"abu_j"`). */
  handle: z.string().max(HANDLE_INPUT_MAX_CHARS),
  state: z.enum(HANDLE_STATES),
  reason: z.enum(HANDLE_INVALID_REASONS).nullable(),
  /** When a `held` handle frees up. */
  heldUntil: isoTimeSchema.nullable(),
});

const displayNameSchema = z.string().max(DISPLAY_NAME_MAX_CHARS).regex(NO_CONTROL, "no control characters");
const bioSchema = z.string().max(BIO_MAX_CHARS).regex(NO_CONTROL_BUT_NEWLINE, "no control characters");
export const avatarIdSchema = z.string().regex(AVATAR_ID_PATTERN, "expected an authored avatar id");

/**
 * `PUT /v1/profile`: fields left out keep their value (defaults on first save); `null` clears one. Clearing or
 * changing the handle tombstones the old one. Text is trimmed server-side; an empty string clears the field.
 * Turning a network's listing off also turns its public trades off.
 */
export const profileUpdateSchema = z.object({
  handle: z.string().max(HANDLE_INPUT_MAX_CHARS).nullable().optional(),
  displayName: displayNameSchema.nullable().optional(),
  bio: bioSchema.nullable().optional(),
  avatar: avatarIdSchema.nullable().optional(),
  listedPractice: z.boolean().optional(),
  listedMainnet: z.boolean().optional(),
  publicTradesPractice: z.boolean().optional(),
  publicTradesMainnet: z.boolean().optional(),
});

/** The owner's own view, with every per-network setting. */
export const myProfileSchema = z.object({
  address: addressSchema,
  handle: z.string().max(HANDLE_MAX_CHARS).nullable(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatar: avatarIdSchema.nullable(),
  listedPractice: z.boolean(),
  listedMainnet: z.boolean(),
  publicTradesPractice: z.boolean(),
  publicTradesMainnet: z.boolean(),
  handleChangedAt: isoTimeSchema.nullable(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const myProfileResponseSchema = z.object({ profile: myProfileSchema.nullable() });

/** What anyone sees for a profile listed on `chainId`. Counts include only accounts listed on that network. */
export const publicProfileSchema = z.object({
  chainId: chainIdSchema,
  address: addressSchema,
  handle: z.string().max(HANDLE_MAX_CHARS).nullable(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatar: avatarIdSchema.nullable(),
  /** The owner shares this network's trades in the feed. */
  publicTrades: z.boolean(),
  followers: z.int().nonnegative(),
  following: z.int().nonnegative(),
  createdAt: isoTimeSchema,
});

/** `0x…` (40 hex) looks up by address; anything else is a handle (a leading "@" is fine). */
export const profileLookupParamsSchema = z.object({
  handleOrAddress: z.string().min(1).max(HANDLE_INPUT_MAX_CHARS),
});
export const chainQuerySchema = z.object({ chainId: z.coerce.number().pipe(chainIdSchema) });

export const handleAvailableRoute = defineRoute({
  method: "GET",
  path: "/v1/handles/:h/available",
  auth: "none",
  params: handleParamsSchema,
  query: undefined,
  body: undefined,
  response: handleAvailabilitySchema,
});

export const myProfileRoute = defineRoute({
  method: "GET",
  path: "/v1/profile",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: myProfileResponseSchema,
});

export const profilePutRoute = defineRoute({
  method: "PUT",
  path: "/v1/profile",
  auth: "session",
  params: undefined,
  query: undefined,
  body: profileUpdateSchema,
  response: myProfileSchema,
});

export const profileGetRoute = defineRoute({
  method: "GET",
  path: "/v1/profile/:handleOrAddress",
  auth: "none",
  params: profileLookupParamsSchema,
  query: chainQuerySchema,
  body: undefined,
  response: publicProfileSchema,
});

export type HandleState = (typeof HANDLE_STATES)[number];
export type HandleAvailability = z.output<typeof handleAvailabilitySchema>;
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;
export type MyProfile = z.output<typeof myProfileSchema>;
export type PublicProfile = z.output<typeof publicProfileSchema>;
