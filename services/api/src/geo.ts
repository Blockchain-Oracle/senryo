import type { GeoResponse } from "@senryo/api-client";
import type { FastifyRequest } from "fastify";
import { COUNTRY_HEADERS, IPV4_PREFIX_OCTETS, IPV6_PREFIX_GROUPS, PERPL_BLOCKED, SANCTIONED } from "./constants.ts";

const COUNTRY_RE = /^[A-Z]{2}$/;

/**
 * Viewer country from the edge (Cloudflare/Vercel-style headers or a Traefik middleware setting `x-geo-country`).
 * Coolify's Traefik adds none by default, so without an edge header the country is unknown and mainnet trading is
 * allowed with the in-app attestation (D-023 app-side check); Perpl enforces its own list.
 */
export function countryOf(request: FastifyRequest): string | null {
  for (const header of COUNTRY_HEADERS) {
    const raw = request.headers[header];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
    if (value && COUNTRY_RE.test(value) && value !== "XX" && value !== "T1") return value;
  }
  return null;
}

export function geoOf(request: FastifyRequest): GeoResponse {
  const country = countryOf(request);
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
