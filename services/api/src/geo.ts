import type { GeoResponse } from "@senryo/api-client";
import type { FastifyRequest } from "fastify";
import { COUNTRY_HEADERS, IPV4_PREFIX_OCTETS, IPV6_PREFIX_GROUPS, PERPL_BLOCKED, SANCTIONED } from "./constants.ts";
import type { GeoDb } from "./geo-db.ts";

const COUNTRY_RE = /^[A-Z]{2}$/;

/**
 * Viewer country: an edge header first (Cloudflare/Vercel-style, or a Traefik middleware setting `x-geo-country`),
 * else DB-IP Lite on the client IP (`request.ip`, Traefik's X-Forwarded-For via trustProxy, S8.15). Unknown (null)
 * still allows mainnet with the in-app attestation (D-023); Perpl enforces its own list.
 */
export function countryOf(request: FastifyRequest, geoDb?: GeoDb): string | null {
  for (const header of COUNTRY_HEADERS) {
    const raw = request.headers[header];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
    if (value && COUNTRY_RE.test(value) && value !== "XX" && value !== "T1") return value;
  }
  const byIp = geoDb?.country(request.ip);
  return byIp && COUNTRY_RE.test(byIp) ? byIp : null;
}

export function geoOf(request: FastifyRequest, geoDb?: GeoDb): GeoResponse {
  const country = countryOf(request, geoDb);
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
