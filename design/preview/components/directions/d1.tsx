"use client";
// D1 "Pocket" — calm consumer. Light default, Neon Clover tokens, DM Sans, soft 20px radii.
import { useState } from "react";
import { Home, LineChart, ArrowLeftRight, CreditCard, QrCode, Search, ScanFace, ChevronRight, Bell, Inbox, Layers, Wallet } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Phone } from "@/components/shell/phone";
import { MenuBar } from "@/components/ui/bottom-menu";
import { WalletSplit } from "@/components/adapted/wallet-split";
import PartitionBar, { PartitionBarSegment, PartitionBarSegmentTitle, PartitionBarSegmentValue } from "@/components/ui/partition-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import MarketWatchlist from "@/components/ui/market-watchlist";
import MarketSnapshotCard from "@/components/ui/market-snapshot";
import Slider from "@/components/ui/slider-number-flow";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import WalletCard from "@/components/ui/wallet-card";
import UpstashRatelimit from "@/components/ui/upstash-ratelimit";
import QRCodeDisplay from "@/components/ui/qr-code-generator";
import { CopyCode } from "@/components/ui/copy-code-button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { EmptyState } from "@/components/ui/empty-state";
import ErrorBlock from "@/components/ui/error-3";
import { useQr } from "@/components/adapted/use-qr";
import { balance, markets, positions, cardHolds, chains, depositAddress, fmtUsd } from "@/lib/mock";
import { Glyph, SectionLabel, ToastOnMount, type Screen } from "./common";

const icon = (I: typeof Home) => (p: React.SVGProps<SVGSVGElement>) => <I {...(p as object)} width={20} height={20} />;
const NAV = [
  { icon: icon(Home), label: "Home" },
  { icon: icon(LineChart), label: "Markets" },
  { icon: icon(ArrowLeftRight), label: "Trade" },
  { icon: icon(CreditCard), label: "Card" },
  { icon: icon(QrCode), label: "Add money" },
];
const Nav = () => (
  <div className="flex justify-center pb-6 [&>div]:rounded-full [&>div]:bg-card/90 [&>div]:shadow-lg [&>div]:backdrop-blur">
    <MenuBar items={NAV} />
  </div>
);

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-3 pt-2">
      <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
      {right ?? <span className="grid size-10 place-items-center rounded-full bg-card shadow-sm"><Bell className="size-5" /></span>}
    </div>
  );
}

const asset = (s: string) => markets.find((m) => m.symbol === s)!;

function HomeScreen() {
  const pct = (n: number) => Math.round((n / balance.total) * 100);
  return (
    <>
      <Header title="Hi, Abu" />
      <div className="px-4">
        <WalletSplit
          total={balance.total}
          sub={<span className="text-[var(--up)]">+{fmtUsd(balance.pnlToday)} today · +{balance.pnlTodayPct}%</span>}
          buckets={[
            { label: "Free to trade", value: balance.freeToTrade, tone: "trade", hint: "Open new positions" },
            { label: "Free to spend", value: balance.freeToSpend, tone: "spend", hint: "Available on your card" },
            { label: "Locked", value: balance.locked, tone: "locked", hint: "Margin + card holds" },
          ]}
        />
        <div className="mt-4 rounded-[var(--radius)] bg-card p-4 shadow-sm">
          <PartitionBar size="sm">
            <PartitionBarSegment num={pct(balance.freeToTrade)}>
              <PartitionBarSegmentTitle className="text-[12px]">Trade</PartitionBarSegmentTitle>
              <PartitionBarSegmentValue>{pct(balance.freeToTrade)}%</PartitionBarSegmentValue>
            </PartitionBarSegment>
            <PartitionBarSegment num={pct(balance.freeToSpend)} variant="secondary">
              <PartitionBarSegmentTitle className="text-[12px]">Spend</PartitionBarSegmentTitle>
              <PartitionBarSegmentValue>{pct(balance.freeToSpend)}%</PartitionBarSegmentValue>
            </PartitionBarSegment>
            <PartitionBarSegment num={pct(balance.locked)} variant="muted">
              <PartitionBarSegmentTitle className="text-[12px]">Locked</PartitionBarSegmentTitle>
              <PartitionBarSegmentValue>{pct(balance.locked)}%</PartitionBarSegmentValue>
            </PartitionBarSegment>
          </PartitionBar>
        </div>
      </div>
      <SectionLabel>Open positions</SectionLabel>
      <div className="mx-4 divide-y divide-border overflow-hidden rounded-[var(--radius)] bg-card shadow-sm">
        {positions.map((p) => (
          <div key={p.symbol} className="flex items-center gap-3 px-4 py-3.5">
            <Glyph m={asset(p.symbol)} />
            <div className="flex-1">
              <p className="font-semibold">{asset(p.symbol).name}</p>
              <p className="text-[12px] text-muted-foreground">{p.side} · {p.lev}x · {fmtUsd(p.size, 0)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold tnum text-[var(--up)]">+{fmtUsd(p.pnl)}</p>
              <p className="text-[12px] text-muted-foreground">Liq {p.liq.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MarketsScreen() {
  const [cat, setCat] = useState("all");
  const list = markets.filter((m) => cat === "all" || m.kind.toLowerCase() === cat);
  return (
    <>
      <Header title="Markets" right={<span className="grid size-10 place-items-center rounded-full bg-card shadow-sm"><Search className="size-5" /></span>} />
      <div className="px-4 pb-3 [&_*]:text-[13px]">
        <SegmentedControl label="Market type" value={cat} onValueChange={setCat} options={[{ value: "all", label: "All" }, { value: "gold", label: "Gold" }, { value: "stock", label: "Stocks" }, { value: "fx", label: "FX" }, { value: "crypto", label: "Crypto" }]} />
      </div>
      <div className="px-4">
        <MarketWatchlist
          title="Popular today"
          initial="XAU"
          className="!rounded-[var(--radius)] shadow-sm"
          assets={list.map((m) => ({ symbol: m.symbol, name: `${m.name} · ${m.session}`, price: m.price, change: m.change, points: m.spark }))}
        />
      </div>
    </>
  );
}

function Ticket() {
  const [side, setSide] = useState("long");
  const [lev, setLev] = useState([5]);
  const gold = asset("XAU");
  const size = 1500;
  const liq = side === "long" ? gold.price * (1 - 0.9 / lev[0]) : gold.price * (1 + 0.9 / lev[0]);
  return (
    <>
      <Header title="Gold" right={<span className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-foreground">Market open</span>} />
      <div className="px-4">
        <MarketSnapshotCard name="Gold · XAU/USD perp" symbol="XAU" values={gold.spark.map((v) => v * 26.4)} venue="Oracle · Pyth" updated="Live · 1s ago" className="!max-w-none !rounded-[var(--radius)] shadow-sm" fmt={(n) => fmtUsd(n)} />
      </div>
      <div className="mx-4 mt-4 space-y-5 rounded-[var(--radius)] bg-card p-5 shadow-sm">
        <SegmentedControl label="Direction" value={side} onValueChange={setSide} options={[{ value: "long", label: "Long ↑" }, { value: "short", label: "Short ↓" }]} />
        <div className="text-center">
          <p className="text-[12px] text-muted-foreground">Amount from Free to trade</p>
          <p className="text-5xl font-bold tracking-tight"><NumberFlow locales="en-US" value={size} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} /></p>
          <p className="mt-1 text-[12px] text-muted-foreground">of {fmtUsd(balance.freeToTrade)} available</p>
        </div>
        <div className="pt-8">
          <Slider value={lev} onValueChange={setLev} min={1} max={20} step={1} />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>1x</span><span>Leverage</span><span>20x</span></div>
        </div>
        <dl className="space-y-2 text-[14px]">
          {[["Position size", fmtUsd(size * lev[0], 0)], ["Liquidation price", fmtUsd(liq)], ["Fee", "$1.20"]].map(([k, v]) => (
            <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold tnum">{v}</dd></div>
          ))}
        </dl>
        <Button className="h-14 w-full rounded-full text-base"><ScanFace className="size-5" />Review {side}</Button>
      </div>
    </>
  );
}

function ConfirmScreen() {
  return (
    <>
      <Ticket />
      <Drawer open>
        <DrawerContent className="mx-auto max-w-[390px] rounded-t-[28px] bg-card">
          <DrawerHeader className="items-center text-center">
            <div className="mb-2 grid size-16 place-items-center rounded-[20px] bg-accent text-accent-foreground"><ScanFace className="size-9" /></div>
            <DrawerTitle className="text-xl">Confirm with Face ID</DrawerTitle>
            <DrawerDescription>Long Gold · 5x · $1,500 from Free to trade</DrawerDescription>
          </DrawerHeader>
          <dl className="mx-4 space-y-2 rounded-[var(--radius)] bg-muted p-4 text-[14px]">
            {[["Entry (est.)", "$2,687.40"], ["Liquidation", "$2,203.67"], ["Free to spend after", fmtUsd(balance.freeToSpend)], ["Network", "Monad · ~1s"]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold tnum">{v}</dd></div>
            ))}
          </dl>
          <DrawerFooter>
            <Button className="h-14 rounded-full text-base"><ScanFace className="size-5" />Confirm</Button>
            <Button variant="ghost">Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function CardScreen() {
  return (
    <>
      <Header title="Card" />
      <div className="flex justify-center px-4">
        <WalletCard
          accounts={[
            { id: "v", label: "Metropolis · Virtual", balance: balance.freeToSpend, currency: "USD", last4: "4242", holder: "ABU", expiry: "09/29", network: "visa", gradient: "bg-[linear-gradient(145deg,hsl(145_70%_38%),hsl(220_45%_14%))]" },
            { id: "g", label: "Gold-backed", balance: 1200, currency: "USD", last4: "7781", holder: "ABU", expiry: "09/29", network: "visa", gradient: "bg-[linear-gradient(145deg,hsl(42_80%_50%),hsl(30_60%_28%))]" },
          ]}
        />
      </div>
      <div className="mx-4 mt-2 flex gap-2">
        <Button className="h-12 flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90"> Add to Apple Wallet</Button>
        <Button variant="secondary" className="h-12 rounded-full px-5">Freeze</Button>
      </div>
      <div className="mx-4 mt-4">
        <UpstashRatelimit title="Daily spending limit" limit={1000} remaining={841} reset={Date.now() + 5 * 3600e3} okLabel="Left to spend today" format={(n) => `$${n}`} className="shadow-sm" />
      </div>
      <SectionLabel>Holds & recent</SectionLabel>
      <div className="mx-4 divide-y divide-border rounded-[var(--radius)] bg-card shadow-sm">
        {cardHolds.map((h) => (
          <div key={h.merchant} className="flex items-center gap-3 px-4 py-3.5">
            <span className="grid size-9 place-items-center rounded-full bg-muted"><Wallet className="size-4" /></span>
            <div className="flex-1"><p className="font-medium">{h.merchant}</p><p className="text-[12px] text-muted-foreground">{h.when}</p></div>
            <div className="text-right">
              <p className="font-semibold tnum">-{fmtUsd(h.amount)}</p>
              <p className={h.status === "Hold" ? "text-[11px] font-semibold text-[var(--gold)]" : "text-[11px] text-muted-foreground"}>{h.status === "Hold" ? "Held from Free to spend" : "Settled"}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FundScreen() {
  const [chain, setChain] = useState("monad");
  const qr = useQr(`ethereum:${depositAddress}`, 280, "#0d1b12", "#ffffff");
  const c = chains.find((x) => x.id === chain)!;
  return (
    <>
      <Header title="Add money" />
      <div className="px-4 pb-3 [&_*]:text-[12px]">
        <SegmentedControl label="From chain" value={chain} onValueChange={setChain} options={chains.map((x) => ({ value: x.id, label: x.name }))} />
      </div>
      <div className="px-4">
        <QRCodeDisplay
          data={qr}
          title={`Send from ${c.name}`}
          description={`USDC, USDT, ETH or AUSD · arrives in ${c.eta} as AUSD in Free to trade`}
          footer={<div className="w-full"><CopyCode code={depositAddress} display={`${depositAddress.slice(0, 10)}…${depositAddress.slice(-6)}`} /></div>}
          className="!max-w-none rounded-[calc(var(--radius)*1.2)] shadow-sm"
        />
      </div>
    </>
  );
}

function StatesScreen({ alt }: { alt: boolean }) {
  return (
    <>
      <ToastOnMount dark={alt} title="Card declined" description="Not enough Free to spend. Your gold position was not touched." />
      <SectionLabel className="pt-28">Loading</SectionLabel>
      <div className="mx-4 space-y-3 rounded-[var(--radius)] bg-card p-5 shadow-sm">
        <TextShimmer className="text-sm font-medium" duration={1.4}>Syncing your balance…</TextShimmer>
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <div className="flex gap-2"><Skeleton className="h-12 flex-1 rounded-xl" /><Skeleton className="h-12 flex-1 rounded-xl" /><Skeleton className="h-12 flex-1 rounded-xl" /></div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
      <SectionLabel>Empty</SectionLabel>
      <div className="px-4">
        <EmptyState className="!p-8 !rounded-[var(--radius)]" title="No positions yet" description="Buy a little gold or a stock to see it here." icons={[Layers, Inbox, LineChart]} action={{ label: "Explore markets", onClick: () => {} }} />
      </div>
      <SectionLabel>Error</SectionLabel>
      <div className="mx-4 overflow-hidden rounded-[var(--radius)] bg-card shadow-sm">
        <ErrorBlock className="!bg-card !py-8" title="Prices are paused" body="The NVDA feed is stale, so new trades are blocked until prices update. Your open positions are safe." reference="FEED-STALE-NVDA" retry="Try again" support="Why?" />
      </div>
    </>
  );
}

export function D1({ screen, alt }: { screen: Screen; alt: boolean }) {
  const body = { home: <HomeScreen />, markets: <MarketsScreen />, trade: <Ticket />, confirm: <ConfirmScreen />, card: <CardScreen />, fund: <FundScreen />, states: <StatesScreen alt={alt} /> }[screen];
  return (
    <Phone theme="d1" dark={alt} nav={screen === "confirm" ? undefined : <Nav />}>
      {body}
    </Phone>
  );
}
