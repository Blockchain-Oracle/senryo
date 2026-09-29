"use client";
// D4 "Bullion" — premium minimal / editorial. 432 Editorial tokens (paper #F7F5F0, ink navy #031A29,
// hairline #D9D6CE, 2px radii) + Amber-Minimal gold accent. Instrument Serif display, Inter UI,
// Geist Mono figures. Slow, quiet motion: sliding digits, morphing pill, metal press.
import { useState } from "react";
import { ScanFace, WifiOff, ArrowUpRight } from "lucide-react";
import { Phone } from "@/components/shell/phone";
import PillMorphTabs from "@/components/ui/pill-morph-tabs";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { GoldLine } from "@/components/adapted/gold-line";
import { StockPortfolioCard } from "@/components/ui/stock-portfolio-card";
import SegmentedButtonGroup from "@/components/ui/segmented-button-group";
import { MetalButton } from "@/components/ui/liquid-glass-button";
import { Component as FaceScan } from "@/components/ui/finger-scan-button";
import { OrderConfirmationCard } from "@/components/ui/order-confirmation-card";
import GlassCard from "@/components/ui/glass-card";
import { WithdrawalCard } from "@/components/ui/card-5";
import { Payment3 } from "@/components/ui/payment-3";
import QRCodeDisplay from "@/components/ui/qr-code-generator";
import { CopyCode } from "@/components/ui/copy-code-button";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import ErrorBlock from "@/components/ui/error-3";
import { useQr } from "@/components/adapted/use-qr";
import { balance, markets, positions, cardHolds, chains, depositAddress, fmtUsd } from "@/lib/mock";
import { ToastOnMount, type Screen } from "./common";

const TABS = [
  { value: "home", label: "Wealth" },
  { value: "markets", label: "Markets" },
  { value: "trade", label: "Trade" },
  { value: "card", label: "Card" },
  { value: "fund", label: "Deposit" },
];
function Nav({ active }: { active: string }) {
  return (
    <div className="px-4 pb-7 pt-2 [&_[role=tablist]]:w-full [&_[role=tablist]]:justify-between [&_[role=tablist]]:border [&_[role=tablist]]:border-border [&_[role=tablist]]:bg-card/90 [&_[role=tablist]]:backdrop-blur [&_button]:text-[13px]">
      <PillMorphTabs key={active} items={TABS} defaultValue={active} />
    </div>
  );
}

function Masthead({ kicker, title, right }: { kicker: string; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border-b border-border px-5 pb-4 pt-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><span>{kicker}</span>{right}</div>
      <h1 className="mt-2 font-display text-[44px] leading-[1] tracking-tight">{title}</h1>
    </div>
  );
}

const asset = (s: string) => markets.find((m) => m.symbol === s)!;
const Row = ({ k, v, sub, accent }: { k: React.ReactNode; v: React.ReactNode; sub?: React.ReactNode; accent?: string }) => (
  <div className="flex items-baseline justify-between border-b border-border py-3.5 last:border-0">
    <div><p className="text-[15px]">{k}</p>{sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}</div>
    <p className={`font-mono text-[15px] tnum ${accent ?? ""}`}>{v}</p>
  </div>
);

function HomeScreen() {
  const pct = (n: number) => `${Math.round((n / balance.total) * 100)}%`;
  return (
    <>
      <Masthead kicker="Tuesday · 29 September" title={<>Good morning,<br /><em>Abu.</em></>} right={<span className="text-[var(--gold)]">● Live</span>} />
      <div className="px-5 pt-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total wealth</p>
        <p className="mt-1 flex items-baseline font-display text-[64px] leading-none tracking-tight">$<SlidingNumber value={12} />,<SlidingNumber value={480} padStart /><span className="text-[32px] text-muted-foreground">.52</span></p>
        <p className="mt-2 font-mono text-[13px] text-[var(--up)]">+{fmtUsd(balance.pnlToday)} · +{balance.pnlTodayPct}% today</p>
      </div>
      <div className="px-2 pt-2">
        <GoldLine marker="W3" data={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10"].map((d, i) => ({ date: d, value: Math.round(11200 + i * 140 + Math.sin(i) * 260) }))} fmt={(v) => `${(v / 1000).toFixed(1)}k`} />
      </div>
      <div className="mx-5 mt-2 border-t border-foreground pt-1">
        <Row k="Free to trade" sub="Open positions in gold, stocks, FX" v={fmtUsd(balance.freeToTrade)} />
        <Row k="Free to spend" sub="Available on your card" v={fmtUsd(balance.freeToSpend)} accent="text-[var(--gold)]" />
        <Row k="Locked" sub="Margin and card holds" v={fmtUsd(balance.locked)} accent="text-muted-foreground" />
      </div>
      <div className="mx-5 mt-2 flex h-1.5 overflow-hidden">
        <span style={{ width: pct(balance.freeToTrade) }} className="bg-primary" />
        <span style={{ width: pct(balance.freeToSpend) }} className="bg-[var(--gold)]" />
        <span style={{ width: pct(balance.locked) }} className="bg-border" />
      </div>
      <p className="px-5 pb-1 pt-8 font-display text-[26px]">Holdings</p>
      <div className="mx-5">
        {positions.map((p) => (
          <Row key={p.symbol} k={<>{asset(p.symbol).name} <span className="text-muted-foreground">· {p.side} {p.lev}×</span></>} sub={`Liquidation ${p.liq.toLocaleString()}`} v={`+${fmtUsd(p.pnl)}`} accent="text-[var(--up)]" />
        ))}
      </div>
    </>
  );
}

function MarketsScreen() {
  const sel = ["XAU", "NVDA", "AAPL", "EUR/USD", "BTC"].map(asset);
  return (
    <>
      <Masthead kicker="The morning brief" title={<>Markets</>} />
      <div className="px-4 pt-4 [&>div]:!max-w-none [&>div]:!rounded-[var(--radius)] [&>div]:border [&>div]:border-border [&>div]:!bg-card [&>div]:shadow-none [&_h3]:font-display">
        <StockPortfolioCard
          totalGain={184.22}
          returnPercentage={1.5}
          asOfDate="29 Sep, 09:41"
          holdings={sel.map((m) => ({ ticker: m.symbol === "EUR/USD" ? "€$" : m.symbol.slice(0, 4), name: `${m.name} · ${m.session}`, shares: m.maxLev, unit: `up to ${m.maxLev}× · ${m.kind}`, lastPrice: m.price, changeValue: +(m.price * m.change / 100).toFixed(2), changePercent: Math.abs(m.change) }))}
          news={[
            { category: "Gold", time: "12 min ago", title: "Bullion firms as real yields slip; central-bank buying steady", source: "Brief" },
            { category: "Equities", time: "40 min ago", title: "Chipmakers lead pre-market on data-centre orders", source: "Brief" },
            { category: "FX", time: "1 hr ago", title: "Euro holds 1.08 ahead of ECB minutes", source: "Brief" },
          ]}
        />
      </div>
    </>
  );
}

function Ticket() {
  const [lev, setLev] = useState("2×");
  const g = asset("XAU");
  const L = parseInt(lev);
  return (
    <>
      <Masthead kicker="Gold · XAU / USD · market open" title={<>Own gold,<br /><em>not the vault.</em></>} />
      <div className="px-5 pt-5">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-[40px] leading-none">${g.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="font-mono text-[13px] text-[var(--up)]">+{g.change}%</p>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">Per troy ounce · oracle price, updated 1s ago</p>
      </div>
      <div className="px-2 pt-2"><GoldLine height={160} marker="11:00" data={["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"].map((d, i) => ({ date: d, value: Math.round(2660 + i * 3.5 + Math.sin(i * 1.3) * 6) }))} fmt={(v) => v.toLocaleString()} /></div>
      <div className="mx-5 mt-3 border-y border-border py-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Allocate</p>
        <p className="font-display text-[56px] leading-none">$1,500</p>
        <p className="mt-1 text-[12px] text-muted-foreground">≈ {(1500 * L / g.price).toFixed(3)} oz exposure · from Free to trade</p>
      </div>
      <div className="mx-5 mt-5">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Leverage</p>
        <div className="[&>div]:w-full [&_button]:flex-1 [&_button]:!rounded-[var(--radius)] [&_button]:font-mono">
          <SegmentedButtonGroup options={["1×", "2×", "5×", "10×"]} selected={lev} onChange={setLev} />
        </div>
      </div>
      <div className="mx-5 mt-4">
        <Row k="Liquidation price" v={L === 1 ? "None" : fmtUsd(g.price * (1 - 0.9 / L))} accent="text-[var(--down)]" />
        <Row k="Financing" v="0.01% / day" />
        <Row k="Free to spend after" v={fmtUsd(balance.freeToSpend)} />
      </div>
      <div className="mx-5 mt-5 flex justify-center [&_button]:!w-full [&>div]:w-full">
        <MetalButton variant="gold" className="h-14 w-full text-[16px]"><ScanFace className="mr-2 inline size-5" />Buy with Face ID</MetalButton>
      </div>
    </>
  );
}

function ConfirmScreen() {
  return (
    <>
      <Masthead kicker="Confirm · passkey" title={<>Look to<br /><em>confirm.</em></>} />
      <div className="flex flex-col items-center px-5 pt-8 [&_button]:!size-24 [&_button]:!border-[var(--gold)] [&_svg]:!size-12 [&_.text-xs]:text-[13px] [&_.text-xs]:text-muted-foreground">
        <FaceScan icon={ScanFace} idle="Face ID · signs on this device, keys never leave it" busy="Verifying…" />
      </div>
      <div className="mx-5 mt-8 border-t border-foreground">
        <Row k="Buy gold · 2×" v="$1,500.00" />
        <Row k="Exposure" v="1.116 oz" />
        <Row k="Liquidation" v="$1,478.07" accent="text-[var(--down)]" />
        <Row k="Settles on" v="Monad · ~1s" />
      </div>
      <p className="px-5 pb-2 pt-8 font-display text-[26px]">Receipt</p>
      <div className="px-4 [&>div]:!max-w-none [&>div]:!rounded-[var(--radius)] [&>div]:!border [&>div]:!border-border [&>div]:!bg-card [&>div]:!text-foreground [&>div]:shadow-none">
        <OrderConfirmationCard title="Gold bought. Position open." orderId="XAU-0042" paymentMethod="Free to trade · Face ID" dateTime="29/09/26 09:41" totalAmount="$1,500.00" buttonText="View position" onGoToAccount={() => {}} />
      </div>
    </>
  );
}

function CardScreen() {
  return (
    <>
      <Masthead kicker="Metropolis · Reserve card" title={<>Spend,<br /><em>stay invested.</em></>} />
      <div className="flex justify-center px-4 pt-6">
        <GlassCard
          sizeClass="h-[214px] w-[340px]"
          radius="18px"
          surface="bg-gradient-to-br from-[#e3c27a] via-[#b8892b] to-[#6b4e00]"
          title={<span className="font-display text-[26px] font-normal tracking-wide">Reserve</span>}
          body={<span className="font-mono tracking-[0.2em] text-white/80">•••• 4242 · 09/29</span>}
          logo={<span className="font-display text-[18px] text-black">M</span>}
          footerLeft={<span className="font-mono text-[12px] text-white">{fmtUsd(balance.freeToSpend)} available</span>}
          footerRight={<span className="font-bold italic text-white">VISA</span>}
        />
      </div>
      <div className="px-4 pt-5 [&>div]:!max-w-none [&>div]:!rounded-[var(--radius)] [&>div]:shadow-none">
        <WithdrawalCard
          amount={250}
          availableBalance={balance.freeToTrade}
          currency="$"
          amountLabel="Top up Free to spend"
          balanceLabel="From Free to trade ·"
          chooseLabel="Move from"
          cta="Move $250 to card"
          defaultSelectedAccountId="trade"
          onWithdraw={() => {}}
          accounts={[
            { id: "trade", initials: "FT", name: "Free to trade", details: fmtUsd(balance.freeToTrade) },
            { id: "gold", initials: "Au", name: "Gold position (reduce)", details: "Closes part of XAU" },
          ]}
        />
      </div>
      <div className="px-4 pt-4 [&>div]:!max-w-none [&>div]:!rounded-[var(--radius)]"><Payment3 /></div>
      <div className="mx-5 mt-4">
        {cardHolds.map((h) => <Row key={h.merchant} k={h.merchant} sub={h.status === "Hold" ? "Pending · held from Free to spend" : `Settled · ${h.when}`} v={`-${fmtUsd(h.amount)}`} accent={h.status === "Hold" ? "text-[var(--gold)]" : ""} />)}
      </div>
    </>
  );
}

function FundScreen() {
  const qr = useQr(depositAddress, 260, "#031a29", "#fffdf8");
  return (
    <>
      <Masthead kicker="Deposit · any chain" title={<>Bring your<br /><em>assets home.</em></>} />
      <div className="px-4 pt-5 [&>div]:!max-w-none [&>div]:!rounded-[var(--radius)] [&>div]:shadow-none [&_.bg-white]:!bg-[#fffdf8] [&_[data-slot=card-title]]:font-display [&_h3]:font-display [&_h3]:text-[24px] [&_h3]:font-normal">
        <QRCodeDisplay data={qr} title="Your Metropolis address" description="Send USDC, USDT, ETH or AUSD. Converted to AUSD and credited to Free to trade." footer={<CopyCode code={depositAddress} display={`${depositAddress.slice(0, 10)}…${depositAddress.slice(-6)}`} className="w-full" />} />
      </div>
      <div className="mx-5 mt-4">
        {chains.map((c) => <Row key={c.id} k={c.name} sub={c.id === "monad" ? "Native · no bridge" : "Via intents · auto-converted"} v={<span className="inline-flex items-center gap-1">{c.eta}<ArrowUpRight className="size-3.5" /></span>} />)}
      </div>
    </>
  );
}

function StatesScreen({ alt }: { alt: boolean }) {
  return (
    <>
      <ToastOnMount dark={alt} kind="success" title="Card payment · Blue Bottle" description="$6.40 held from Free to spend. Gold untouched." />
      <Masthead kicker="Quiet states" title={<>When the<br /><em>market sleeps.</em></>} />
      <p className="px-5 pb-2 pt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Loading</p>
      <div className="mx-5 border border-border bg-card p-4">
        <SkeletonSwap ready={false} lines={3} label="Loading holdings"><div /></SkeletonSwap>
      </div>
      <p className="px-5 pb-2 pt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Empty</p>
      <div className="mx-5 border border-border bg-card">
        <Empty className="!p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><span className="font-display text-[22px]">Au</span></EmptyMedia>
            <EmptyTitle className="font-display text-[26px] font-normal">No holdings yet</EmptyTitle>
            <EmptyDescription>Start with an ounce of gold — or a fraction of one.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button size="sm" className="rounded-[var(--radius)]">Browse markets</Button></EmptyContent>
        </Empty>
      </div>
      <p className="px-5 pb-2 pt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Error</p>
      <div className="mx-5 border border-border bg-card">
        <ErrorBlock className="!bg-card !py-8" title="Equities are closed" body="NVDA reopens at 09:30 New York. You can close positions, but not open new ones." reference="SESSION-CLOSED" retry="Set a reminder" support="Trading hours" />
      </div>
      <div className="mx-5 mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><WifiOff className="size-4" />Offline states reuse the same card, never a full-screen takeover.</div>
    </>
  );
}

export function D4({ screen, alt }: { screen: Screen; alt: boolean }) {
  const active = screen === "confirm" ? "trade" : screen === "states" ? "home" : screen;
  const body = { home: <HomeScreen />, markets: <MarketsScreen />, trade: <Ticket />, confirm: <ConfirmScreen />, card: <CardScreen />, fund: <FundScreen />, states: <StatesScreen alt={alt} /> }[screen];
  return (
    <Phone theme="d4" dark={alt} nav={<Nav active={active} />}>
      {body}
    </Phone>
  );
}
