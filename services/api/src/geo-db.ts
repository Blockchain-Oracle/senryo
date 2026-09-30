/**
 * Country by client IP (S8.15, D-038) when the edge sends no country header — Coolify's Traefik sends none (D-121).
 * Source: DB-IP "IP to Country Lite" (free, no account; CC BY 4.0 — attribution "IP Geolocation by DB-IP" on the
 * about/legal pages). Downloaded at boot (this month's file, else last month's) and refreshed weekly; a failed download
 * leaves the country unknown (null), which is the behaviour before this existed — never a crash, never a block.
 */
import { gunzipSync } from "node:zlib";
import { AddressNotFoundError, Reader, type ReaderModel } from "@maxmind/geoip2-node";
import type { Logger } from "@senryo/service-common";
import { GEO_DB_REFRESH_MS, GEO_DB_TIMEOUT_MS, GEO_DB_URL } from "./constants.ts";

const MONTH_DIGITS = 2;

function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(MONTH_DIGITS, "0")}`;
}

export class GeoDb {
  private reader: ReaderModel | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly log: Logger) {}

  /** Loads in the background: the api serves at once; lookups return null until the file is in. */
  start(): void {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), GEO_DB_REFRESH_MS);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    const now = new Date();
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    for (const month of [monthOf(now), monthOf(last)]) {
      try {
        const res = await fetch(GEO_DB_URL.replace("{month}", month), {
          signal: AbortSignal.timeout(GEO_DB_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        this.reader = Reader.openBuffer(gunzipSync(Buffer.from(await res.arrayBuffer())));
        this.log.info({ month }, "geo db loaded");
        return;
      } catch (error) {
        this.log.warn({ month, err: error instanceof Error ? error.message : String(error) }, "geo db download failed");
      }
    }
  }

  /** ISO 3166-1 alpha-2, or null (no database yet, private/reserved address, not listed). */
  country(ip: string): string | null {
    if (!this.reader) return null;
    try {
      return this.reader.country(ip).country?.isoCode ?? null;
    } catch (error) {
      if (!(error instanceof AddressNotFoundError)) this.log.debug({ ip }, "geo lookup failed");
      return null;
    }
  }
}
