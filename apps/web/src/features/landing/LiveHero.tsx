"use client";
/**
 * The landing's live line (pivot S6.8): BTC as it streams, the 1-minute window's line (K) dashed across it, the
 * countdown, and what Up and Down pay on $5 right now — the terminal's own chart and quote pass (`LiveChart`,
 * `useLiveQuote`), so the landing shows the product, not a picture of it. Loaded after first paint; one stream.
 */
import { DEFAULT_CADENCE, useCallWindow } from "@senryo/calls/react";
import { clockText } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { LiveProvider } from "@senryo/live/react";
import { QueryEnvProvider, useWindowLoad } from "@senryo/query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { LiveText } from "@/components/kit/live-text";
import { LiveChart } from "@/features/terminal/chart/LiveChart";
import { useLiveQuote } from "@/features/terminal/useLiveQuote";
import { api } from "@/lib/account/api";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { appLive } from "@/lib/live";

const SYMBOL = "BTC";
const STAKE = 5_000_000n;
const MARK = 24;

function Hero() {
  const t = useCallWindow(SYMBOL, DEFAULT_CADENCE, undefined);
  const load = useWindowLoad(t.now > 0 ? t.window.expiry : undefined);
  const q = useLiveQuote(t, STAKE, "value" in load ? load.value : undefined);
  useEffect(() => appLive().stream.acquire(), []);
  return (
    <div className="live-hero dark">
      <div className="live-hero-head">
        <span className="live-hero-symbol">
          <EntityMark id={marketId(SYMBOL)} size={MARK} decorative ground="var(--background)" />
          BTC · 1m
        </span>
        <span className="live-hero-clock tnum">
          {t.window.trading
            ? `calls close in ${clockText(t.window.closesIn)}`
            : `next window in ${clockText(t.window.expiry - t.now)}`}
        </span>
      </div>
      <div className="live-hero-chart">
        <LiveChart
          symbol={SYMBOL}
          overlay={q.overlay}
          waiting="Waiting for BTC…"
          label="Bitcoin's live price and this window's line"
        />
      </div>
      <div className="live-hero-calls">
        <Link href="/app/trade/btc/" className="live-hero-call is-up">
          <strong>Up</strong>
          <LiveText value={q.firstLine} />
        </Link>
        <Link href="/app/trade/btc/" className="live-hero-call is-down">
          <strong>Down</strong>
          <LiveText value={q.secondLine} />
        </Link>
      </div>
      <p className="live-hero-note">On $5 · the dashed line is where this window opened</p>
    </div>
  );
}

export function LiveHero() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <QueryEnvProvider chainId={ACTIVE_NETWORK.chainId} api={api()}>
        <LiveProvider live={appLive()}>
          <Hero />
        </LiveProvider>
      </QueryEnvProvider>
    </QueryClientProvider>
  );
}

export default LiveHero;
