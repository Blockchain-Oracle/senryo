import type { GeoResponse } from "@senryo/api-client";
import type { FastifyRequest } from "fastify";
import {
  type COUNTRY_HEADERS,
  IPV4_PREFIX_OCTETS,
  IPV6_PREFIX_GROUPS,
  PERPL_BLOCKED,
  SANCTIONED,
} from "./constants.ts";
import type { GeoDb } from "./geo-db.ts";

const COUNTRY_RE = /^[A-Z]{2}$/;

export interface GeoSources {
  /** DB-IP Lite lookup on `request.ip` (one trusted proxy hop, S8.5b). */
  db?: GeoDb | undefined;
  /**
   * An edge header to trust (`cf-ipcountry` …) — only when that edge really fronts the origin and the origin accepts
   * nothing else (env `TRUSTED_COUNTRY_HEADER`). Unset (Coolify's Traefik, today): client-sent country headers are
   * ignored, otherwise anyone could claim an allowed country (S8.5b #3).
   */
  trustedHeader?: (typeof COUNTRY_HEADERS)[number] | undefined;
}

/** Viewer country: the trusted edge header if configured, else DB-IP on the client IP; null = unknown. */
export function countryOf(request: FastifyRequest, sources: GeoSources = {}): string | null {
  if (sources.trustedHeader) {
    const raw = request.headers[sources.trustedHeader];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
    if (value && COUNTRY_RE.test(value) && value !== "XX" && value !== "T1") return value;
  }
  const byIp = sources.db?.country(request.ip);
  return byIp && COUNTRY_RE.test(byIp) ? byIp : null;
}

export function geoOf(request: FastifyRequest, sources: GeoSources = {}): GeoResponse {
  const country = countryOf(request, sources);
  const sanctioned = country !== null && (SANCTIONED as readonly string[]).includes(country);
  const perplBlocked = country !== null && (PERPL_BLOCKED as readonly string[]).includes(country);
  return {
    country,
    mainnetTradingAllowed: !sanctioned && !perplBlocked,
    perplAllowed: !perplBlocked,
    reason: sanctioned ? "sanctioned jurisdiction" : perplBlocked ? "Perpl restricted region" : null,
  };
}

/** Rate-limit key for a client network: IPv4 /24 or IPv6 /48. */
export function networkPrefix(ip: string): string {
  if (ip.includes(":")) return `${ip.split(":").slice(0, IPV6_PREFIX_GROUPS).join(":")}::/48`;
  return `${ip.split(".").slice(0, IPV4_PREFIX_OCTETS).join(".")}.0/24`;
}
