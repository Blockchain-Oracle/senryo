import * as z from "zod";
import { PREFS_BLOB_MAX_CHARS, VAULT_LABEL_MAX_CHARS, VAULT_MAX_CHARS } from "../constants.ts";
import { addressSchema, base64UrlSchema, isoTimeSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * Untrusted storage (D-040): the server keeps opaque client-encrypted bytes and can neither read nor forge them.
 *
 * /v1/prefs — one encrypted blob per address (HKDF(prf, "senryo.prefs.v1") → AES-GCM, base64url). Session-authed
 * reads and writes; optimistic concurrency via `ifVersion` (409 CONFLICT when stale); DELETE is F09 "delete my data".
 *
 * /v1/vault — second-passkey recovery (F07/F08): a Mera secret-vault JSON v1 (the account's secret encrypted under
 * passkey B's PRF). Writes are session-authed (the SIWE-signed owner); the read by credential id is public so a fresh
 * device can fetch the vault right after passkey B's discoverable assertion — AES-GCM makes it safe on untrusted
 * storage and any tampering fails decryption. At most VAULTS_PER_ACCOUNT_MAX per address.
 */

export const prefsResponseSchema = z.object({
  blob: base64UrlSchema.max(PREFS_BLOB_MAX_CHARS).nullable(),
  /** 0 = nothing stored yet. */
  version: z.int().nonnegative(),
  updatedAt: isoTimeSchema.nullable(),
});

export const prefsPutRequestSchema = z.object({
  blob: base64UrlSchema.max(PREFS_BLOB_MAX_CHARS),
  /** The version the client last read (0 for a first write). */
  ifVersion: z.int().nonnegative(),
});

export const prefsPutResponseSchema = z.object({
  version: z.int().positive(),
  updatedAt: isoTimeSchema,
});

export const deletedResponseSchema = z.object({ deleted: z.boolean() });

/** Mera `PasskeySecretVault` (references/mera library/src/types.ts), version 1. */
export const meraVaultSchema = z.object({
  version: z.literal(1),
  credential: z.object({
    credentialId: base64UrlSchema,
    transports: z.array(z.string().max(VAULT_LABEL_MAX_CHARS)).optional(),
  }),
  prfSalt: base64UrlSchema,
  nonce: base64UrlSchema,
  ciphertext: base64UrlSchema.max(VAULT_MAX_CHARS),
});

export const vaultPutRequestSchema = z.object({
  vault: meraVaultSchema,
  /** Shown in Settings → Recovery ("iPad passkey · 30 Sep"). Not secret. */
  label: z.string().max(VAULT_LABEL_MAX_CHARS).optional(),
});

export const vaultRecordSchema = z.object({
  credentialId: base64UrlSchema,
  address: addressSchema,
  label: z.string().nullable(),
  vault: meraVaultSchema,
  createdAt: isoTimeSchema,
});

export const vaultSummarySchema = vaultRecordSchema.omit({ vault: true });

export const vaultListResponseSchema = z.object({ vaults: z.array(vaultSummarySchema) });

export const vaultParamsSchema = z.object({ credentialId: base64UrlSchema });

export const prefsGetRoute = defineRoute({
  method: "GET",
  path: "/v1/prefs",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: prefsResponseSchema,
});

export const prefsPutRoute = defineRoute({
  method: "PUT",
  path: "/v1/prefs",
  auth: "session",
  params: undefined,
  query: undefined,
  body: prefsPutRequestSchema,
  response: prefsPutResponseSchema,
});

export const prefsDeleteRoute = defineRoute({
  method: "DELETE",
  path: "/v1/prefs",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: deletedResponseSchema,
});

export const vaultPutRoute = defineRoute({
  method: "PUT",
  path: "/v1/vault",
  auth: "session",
  params: undefined,
  query: undefined,
  body: vaultPutRequestSchema,
  response: vaultSummarySchema,
});

export const vaultGetRoute = defineRoute({
  method: "GET",
  path: "/v1/vault/:credentialId",
  auth: "none",
  params: vaultParamsSchema,
  query: undefined,
  body: undefined,
  response: vaultRecordSchema,
});

export const vaultListRoute = defineRoute({
  method: "GET",
  path: "/v1/vault",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: vaultListResponseSchema,
});

export const vaultDeleteRoute = defineRoute({
  method: "DELETE",
  path: "/v1/vault/:credentialId",
  auth: "session",
  params: vaultParamsSchema,
  query: undefined,
  body: undefined,
  response: deletedResponseSchema,
});

export type PrefsResponse = z.output<typeof prefsResponseSchema>;
export type PrefsPutRequest = z.input<typeof prefsPutRequestSchema>;
export type MeraVault = z.output<typeof meraVaultSchema>;
export type VaultPutRequest = z.input<typeof vaultPutRequestSchema>;
export type VaultRecord = z.output<typeof vaultRecordSchema>;
export type VaultSummary = z.output<typeof vaultSummarySchema>;
