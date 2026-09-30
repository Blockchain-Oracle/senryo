import {
  type MeraVault,
  prefsDeleteRoute,
  prefsGetRoute,
  prefsPutRoute,
  VAULTS_PER_ACCOUNT_MAX,
  vaultDeleteRoute,
  vaultGetRoute,
  vaultListRoute,
  vaultPutRoute,
} from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, type Session, sendRoute } from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { BLOB_BODY_LIMIT_BYTES } from "../constants.ts";
import type { ApiContext } from "../context.ts";

/**
 * Untrusted storage (D-040/D-111): opaque client-encrypted bytes; the server can neither read nor forge them.
 * Prefs: optimistic concurrency on `version`. Vaults: owner-written, readable by credential id (fresh-device flow).
 */
export function registerStorageRoutes(app: HttpServer, ctx: ApiContext): void {
  const session = async (request: FastifyRequest): Promise<Session> => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    return ctx.sessions.require(request);
  };

  app.get(prefsGetRoute.path, async (request, reply) => {
    const s = await session(request);
    const [row] = await ctx.db<{ blob: string; version: number; updated_at: Date }[]>`
      SELECT blob, version, updated_at FROM prefs_blobs WHERE address = ${s.address.toLowerCase()}`;
    return sendRoute(reply, prefsGetRoute, {
      blob: row?.blob ?? null,
      version: row?.version ?? 0,
      updatedAt: row?.updated_at.toISOString() ?? null,
    });
  });

  app.put(prefsPutRoute.path, { bodyLimit: BLOB_BODY_LIMIT_BYTES }, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(prefsPutRoute, request);
    const address = s.address.toLowerCase();
    const rows =
      body.ifVersion === 0
        ? await ctx.db<{ version: number; updated_at: Date }[]>`
            INSERT INTO prefs_blobs (address, blob, version) VALUES (${address}, ${body.blob}, 1)
            ON CONFLICT (address) DO NOTHING RETURNING version, updated_at`
        : await ctx.db<{ version: number; updated_at: Date }[]>`
            UPDATE prefs_blobs SET blob = ${body.blob}, version = version + 1, updated_at = now()
             WHERE address = ${address} AND version = ${body.ifVersion} RETURNING version, updated_at`;
    const [row] = rows;
    if (!row) throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "prefs changed elsewhere; read and merge first");
    return sendRoute(reply, prefsPutRoute, { version: row.version, updatedAt: row.updated_at.toISOString() });
  });

  app.delete(prefsDeleteRoute.path, async (request, reply) => {
    const s = await session(request);
    const deleted = await ctx.db`DELETE FROM prefs_blobs WHERE address = ${s.address.toLowerCase()} RETURNING address`;
    return sendRoute(reply, prefsDeleteRoute, { deleted: deleted.length > 0 });
  });

  app.put(vaultPutRoute.path, { bodyLimit: BLOB_BODY_LIMIT_BYTES }, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(vaultPutRoute, request);
    const address = s.address.toLowerCase();
    const credentialId = body.vault.credential.credentialId;
    const [owner] = await ctx.db<
      { address: string }[]
    >`SELECT address FROM vault_blobs WHERE credential_id = ${credentialId}`;
    if (owner && owner.address !== address)
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "credential already holds a vault");
    const [count] = await ctx.db<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM vault_blobs WHERE address = ${address}`;
    if (!owner && (count?.n ?? 0n) >= BigInt(VAULTS_PER_ACCOUNT_MAX)) {
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "vault limit reached; remove one first");
    }
    const [row] = await ctx.db<{ created_at: Date }[]>`
      INSERT INTO vault_blobs (credential_id, address, label, vault)
      VALUES (${credentialId}, ${address}, ${body.label ?? null}, ${ctx.db.json(body.vault as never)})
      ON CONFLICT (credential_id) DO UPDATE SET label = EXCLUDED.label, vault = EXCLUDED.vault
        WHERE vault_blobs.address = EXCLUDED.address
      RETURNING created_at`;
    // A concurrent first write by another account won the row: nothing changed here (S8.5b #8).
    if (!row) throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "credential already holds a vault");
    return sendRoute(reply, vaultPutRoute, {
      credentialId,
      address: getAddress(address),
      label: body.label ?? null,
      createdAt: (row?.created_at ?? new Date()).toISOString(),
    });
  });

  app.get(
    vaultGetRoute.path,
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { params } = parseRoute(vaultGetRoute, request);
      const [row] = await ctx.db<{ address: string; label: string | null; vault: MeraVault; created_at: Date }[]>`
      SELECT address, label, vault, created_at FROM vault_blobs WHERE credential_id = ${params.credentialId}`;
      if (!row) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no vault for this passkey");
      return sendRoute(reply, vaultGetRoute, {
        credentialId: params.credentialId,
        address: getAddress(row.address) as Address,
        label: row.label,
        vault: row.vault,
        createdAt: row.created_at.toISOString(),
      });
    },
  );

  app.get(vaultListRoute.path, async (request, reply) => {
    const s = await session(request);
    const rows = await ctx.db<{ credential_id: string; label: string | null; created_at: Date }[]>`
      SELECT credential_id, label, created_at FROM vault_blobs WHERE address = ${s.address.toLowerCase()} ORDER BY created_at`;
    return sendRoute(reply, vaultListRoute, {
      vaults: rows.map((r) => ({
        credentialId: r.credential_id,
        address: s.address,
        label: r.label,
        createdAt: r.created_at.toISOString(),
      })),
    });
  });

  app.delete(vaultDeleteRoute.path, async (request, reply) => {
    const s = await session(request);
    const { params } = parseRoute(vaultDeleteRoute, request);
    const deleted = await ctx.db`DELETE FROM vault_blobs WHERE credential_id = ${params.credentialId}
                                  AND address = ${s.address.toLowerCase()} RETURNING credential_id`;
    return sendRoute(reply, vaultDeleteRoute, { deleted: deleted.length > 0 });
  });
}
