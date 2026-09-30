import { API_SESSION_TTL_SECONDS } from "@senryo/api-client";
import { getAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { FastifyRequest } from "fastify";
import { jwtVerify, SignJWT } from "jose";
import { HTTP_STATUS, MS_PER_SECOND } from "./constants.ts";
import { HttpError } from "./http.ts";

/**
 * API session token (D-111): HS256 JWT issued by services/api after a verified SIWE signature and accepted by
 * services/card. Secret `API_SESSION_SECRET` (≥ 32 bytes, runtime env, shared by api + card). Subject = the address.
 */
const ISSUER = "senryo-api";
const AUDIENCE = "senryo";
const ALG = "HS256";
const MIN_SECRET_BYTES = 32;

export interface Session {
  address: `0x${string}`;
  chainId: ChainId;
  expiresAt: Date;
}

export class SessionKeys {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
    if (this.key.length < MIN_SECRET_BYTES) throw new Error("API_SESSION_SECRET must be at least 32 bytes");
  }

  async issue(
    address: string,
    chainId: ChainId,
    ttlSeconds: number = API_SESSION_TTL_SECONDS,
  ): Promise<Session & { token: string }> {
    const now = Math.floor(Date.now() / MS_PER_SECOND);
    const exp = now + ttlSeconds;
    const token = await new SignJWT({ chainId })
      .setProtectedHeader({ alg: ALG })
      .setSubject(getAddress(address))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, address: getAddress(address), chainId, expiresAt: new Date(exp * MS_PER_SECOND) };
  }

  async verify(token: string): Promise<Session | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: [ALG] });
      if (!payload.sub || typeof payload.chainId !== "number" || !payload.exp) return undefined;
      return {
        address: getAddress(payload.sub),
        chainId: payload.chainId as ChainId,
        expiresAt: new Date(payload.exp * MS_PER_SECOND),
      };
    } catch {
      return undefined;
    }
  }

  /** `Authorization: Bearer <token>` → session, or a 401 HttpError. */
  async require(request: FastifyRequest): Promise<Session> {
    const header = request.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    const session = scheme === "Bearer" && token ? await this.verify(token) : undefined;
    if (!session) throw new HttpError(HTTP_STATUS.unauthorized, "UNAUTHORIZED", "sign in first (SIWE session)");
    return session;
  }
}
