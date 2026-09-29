"use client";
// D3 "Loud" — bold expressive. Neo Brutalism tokens (cream, black 2px borders, hard 4px shadows,
// red / electric blue / yellow), Space Grotesk display + Space Mono data, 0 radius, big numbers,
// tactile press-down buttons, hold-to-confirm and confetti on fill.
import { useRef, useState } from "react";
import { ScanFace, Flame, Inbox, Layers, LineChart, Hand } from "lucide-react";
import { Phone } from "@/components/shell/phone";
import { RetroButton } from "@/components/ui/retro-button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AppleActivityCard } from "@/components/ui/apple-activity-ring";
import { CryptoCard } from "@/components/ui/asset-card";
import { StockCard } from "@/components/ui/stock-card";
import { PredictionMarketCard } from "@/components/ui/prediction-market-card";
import SegmentedButtonGroup from "@/components/ui/segmented-button-group";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { ButtonHoldAndRelease } from "@/components/ui/hold-and-release-button";
import { AnimatedTicket } from "@/components/ui/ticket-confirmation-card";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { CreditCard } from "@/components/ui/credit-card";
import { SegmentedProgress } from "@/components/ui/progress-bar";
import QRCodeDisplay from "@/components/ui/qr-code-generator";
import { CopyCode } from "@/components/ui/copy-code-button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingState from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertToast } from "@/components/ui/alert-toast";
import { useQr } from "@/components/adapted/use-qr";
import { balance, markets, positions, cardHolds, chains, depositAddress, fmtUsd } from "@/lib/mock";
import { Glyph, type Screen } from "./common";

const box = "border-2 border-foreground bg-card shadow-hard";
const NAV = ["Home", "Markets", "Trade", "Card", "Add $"];
const navFor: Record<Screen, string> = { home: "Home", markets: "Markets", trade: "Trade", confirm: "Trade", card: "Card", fund: "Add $", states: "Home" };

function Nav({ active }: { active: string }) {
  return (
    <div className="flex justify-between gap-1 border-t-2 border-foreground bg-background px-2 pb-6 pt-3 [&_button]:!w-auto [&_button]:flex-1">
      {NAV.map((n) => (
        <RetroButton key={n} variant={n === active ? "default" : "white"} className="h-10 text-[12px] font-bold">{n}</RetroButton>
      ))}
    </div>
  );
}

function Title({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="px-4 pb-3 pt-1">
      {kicker && <p className="font-mono text-[11px] font-bold uppercase">{kicker}</p>}
      <h1 className="font-display text-[40px] font-bold leading-[0.95] tracking-tighter">{children}</h1>
    </div>
  );
}

const asset = (s: string) => markets.find((m) => m.symbol === s)!;
const logo = (sym: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='${bg}'/><text x='32' y='41' font-family='Arial' font-weight='700' font-size='22' text-anchor='middle' fill='white'>${sym.slice(0, 2)}</text></svg>`)}`;

function HomeScreen() {
  return (
    <>
      <Title kicker="Your money, all of it">
        $<NumberTicker value={balance.total} decimalPlaces={2} className="font-display tracking-tighter text-foreground" />
      </Title>
      <div className="mx-4 flex items-center gap-2">
        <span className="border-2 border-foreground bg-[var(--up)] px-2 py-0.5 font-mono text-[12px] font-bold text-white">▲ {fmtUsd(balance.pnlToday)} TODAY</span>
      </div>
      <div className={`mx-4 mt-4 ${box} overflow-hidden [&_h2]:hidden [&>div]:!p-4`}>
        <AppleActivityCard
          title="Split"
          data={[
            { label: "FREE TO TRADE", value: 58, color: "var(--chart-1)", size: 180, current: 7210, target: 12480, unit: "", display: "$7,210" },
            { label: "FREE TO SPEND", value: 25, color: "var(--chart-3)", size: 140, current: 3120, target: 12480, unit: "", display: "$3,120" },
            { label: "LOCKED", value: 17, color: "var(--foreground)", size: 100, current: 2150, target: 12480, unit: "", display: "$2,150" },
          ]}
        />
      </div>
      <p className="px-4 pb-2 pt-6 font-display text-[22px] font-bold">Your bets on the world</p>
      <div className="flex flex-col items-center gap-4 px-4 [&>*]:!w-full [&>*]:border-2 [&>*]:border-foreground [&>*]:shadow-hard">
        {positions.map((p) => (
          <CryptoCard
            key={p.symbol}
            icon={<span className="font-bold">{p.symbol === "XAU" ? "Au" : "Nv"}</span>}
            name={asset(p.symbol).name}
            ticker={p.side.toUpperCase()}
            percentageChange={+((p.pnl / p.size) * 100 * p.lev).toFixed(2)}
            currentPrice={asset(p.symbol).price}
            portfolioValue={p.size + p.pnl}
            portfolioChange={p.pnl}
            leverage={p.lev}
            gradientFrom={p.symbol === "XAU" ? "from-yellow-500" : "from-blue-600"}
          />
        ))}
      </div>
    </>
  );
}

function MarketsScreen() {
  return (
    <>
      <Title kicker="What's moving">Markets</Title>
      <div className={`mx-4 ${box} [&>div]:!max-w-none [&>div]:!rounded-none [&>div]:!border-0 [&>div]:!shadow-none`}>
        <PredictionMarketCard
          question="Gold today: are you long or short?"
          teamName="Gold"
          teamLogo={logo("Au", "#e0a800")}
          initialTimeInSeconds={4 * 3600}
          totalBank={1452000}
          yesBank={842000}
          noBank={610000}
          initialYesVotes={58}
          initialNoVotes={42}
          yesPlayers={2311}
          noPlayers={1642}
          labels={{ hot: "TRENDING", tag: "GOLD", yes: "LONG", no: "SHORT", bank: "OI", voted: "Crowd", players: "TRADERS", betYes: "GO LONG ↗", betNo: "GO SHORT ↘" }}
        />
      </div>
      <div className="mt-5 space-y-3 px-4 [&>div]:!rounded-none [&>div]:border-2 [&>div]:border-foreground [&>div]:shadow-hard">
        {["NVDA", "AAPL", "TSLA", "EUR/USD", "BTC"].map((s) => {
          const m = asset(s);
          return <StockCard key={s} logoSrc={logo(s, ({ NVDA: "#76b900", AAPL: "#111", TSLA: "#e31937", "EUR/USD": "#2a5bd7", BTC: "#f7931a" } as Record<string, string>)[s])} ticker={s} name={`${m.name} · up to ${m.maxLev}x`} price={m.price} change={m.change} onBuy={() => {}} />;
        })}
      </div>
    </>
  );
}

function TicketScreen({ done }: { done?: boolean }) {
  const [side, setSide] = useState("Long");
  const [lev, setLev] = useState("5x");
  const conf = useRef<ConfettiRef>(null);
  const g = asset("XAU");
  const L = parseInt(lev);
  if (done)
    return (
      <>
        <Confetti ref={conf} className="pointer-events-none absolute left-0 top-0 z-50 size-full" options={{ colors: ["#ff3333", "#ffff00", "#0066ff", "#00c853"] }} />
        <Title kicker="Filled in 0.9s on Monad">You&apos;re long gold.</Title>
        <div className="flex justify-center px-4 [&>div]:border-2 [&>div]:border-foreground [&>div]:shadow-hard">
          <AnimatedTicket title="Order filled" subtitle="Long Gold · 5x · receipt saved to Activity" ticketId="XAU-L-5X-0042" amount={1500} date={new Date(2026, 8, 29, 9, 41)} cardHolder="Signed with Face ID" last4Digits="4242" barcodeValue="0x7a3f9c2e41b0d5e8" />
        </div>
        <div className="mx-4 mt-4 grid grid-cols-2 gap-3 font-mono text-[12px]">
          <div className={`${box} p-3`}><p className="font-bold">ENTRY</p><p className="text-[18px] font-bold">$2,687.40</p></div>
          <div className={`${box} p-3`}><p className="font-bold">LIQ</p><p className="text-[18px] font-bold text-[var(--down)]">$2,203.67</p></div>
        </div>
      </>
    );
  return (
    <>
      <Title kicker={`XAU · $${g.price.toLocaleString()} · +${g.change}%`}>Gold</Title>
      <div className="px-4 [&_button]:flex-1 [&>div]:w-full [&_button]:!rounded-none [&_button]:border-2 [&_button]:border-foreground [&_button]:text-[15px] [&_button]:font-bold">
        <SegmentedButtonGroup options={["Long", "Short"]} selected={side} onChange={setSide} />
      </div>
      <div className={`mx-4 mt-4 ${box} p-5 text-center`}>
        <p className="font-mono text-[12px] font-bold">YOU PUT IN</p>
        <p className="font-display text-[64px] font-bold leading-none tracking-tighter">$1,500</p>
        <p className="mt-1 font-mono text-[12px]">from {fmtUsd(balance.freeToTrade)} Free to trade</p>
      </div>
      <div className={`mx-4 mt-4 ${box} p-4`}>
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[12px] font-bold">LEVERAGE</p>
          <p className="flex items-baseline font-display text-[40px] font-bold leading-none"><SlidingNumber value={L} />x</p>
        </div>
        <div className="mt-3 [&_button]:flex-1 [&>div]:w-full [&_button]:!rounded-none [&_button]:border-2 [&_button]:border-foreground [&_button]:font-mono [&_button]:font-bold">
          <SegmentedButtonGroup options={["2x", "5x", "10x", "20x"]} selected={lev} onChange={setLev} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div><p className="font-bold">SIZE</p><p className="text-[14px]">{fmtUsd(1500 * L, 0)}</p></div>
          <div><p className="font-bold">LIQ</p><p className="text-[14px] text-[var(--down)]">{fmtUsd(g.price * (1 - 0.9 / L), 0)}</p></div>
          <div><p className="font-bold">FEE</p><p className="text-[14px]">$1.20</p></div>
        </div>
      </div>
      <div className="mx-4 mt-5">
        <ButtonHoldAndRelease
          holdDuration={1200}
          icon={<Hand className="size-5" />}
          label={`HOLD TO ${side.toUpperCase()} · FACE ID`}
          releaseLabel={<><ScanFace className="size-5" /> KEEP HOLDING…</>}
          className="h-16 w-full !rounded-none border-2 !border-foreground !bg-primary !text-primary-foreground text-[16px] font-bold shadow-hard"
          fillClassName="!bg-foreground/25"
        />
        <p className="mt-2 text-center font-mono text-[11px]">Hold 1.2s, then Face ID signs it. No accidental trades.</p>
      </div>
    </>
  );
}

function CardScreen() {
  return (
    <>
      <Title kicker="Spend what you're not trading">Card</Title>
      <div className="flex justify-center px-4 py-2">
        <CreditCard cardNumber="4111 1111 1111 4242" cardHolder="ABU" expiryDate="09/29" />
      </div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <RetroButton variant="darkGray" className="!w-full h-12 font-bold"> Pay</RetroButton>
        <RetroButton variant="white" className="!w-full h-12 font-bold">Freeze</RetroButton>
      </div>
      <div className={`mx-4 mt-5 ${box} p-4 [&>div]:!max-w-none`}>
        <SegmentedProgress value={84} segments={20} label="$841 of $1,000 left today" showPercentage={false} showDemo={false} />
      </div>
      <p className="px-4 pb-2 pt-6 font-display text-[22px] font-bold">Holds</p>
      <div className={`mx-4 ${box} divide-y-2 divide-foreground`}>
        {cardHolds.map((h) => (
          <div key={h.merchant} className="flex items-center justify-between px-4 py-3">
            <div><p className="font-bold">{h.merchant}</p><p className="font-mono text-[11px]">{h.when}</p></div>
            <div className="text-right">
              <p className="font-mono font-bold">-{fmtUsd(h.amount)}</p>
              <span className={`border-2 border-foreground px-1.5 font-mono text-[10px] font-bold ${h.status === "Hold" ? "bg-secondary" : "bg-muted"}`}>{h.status.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FundScreen() {
  const [chain, setChain] = useState("Monad");
  const qr = useQr(depositAddress, 260, "#000000", "#ffff00");
  return (
    <>
      <Title kicker="From any chain, in seconds">Add money</Title>
      <div className="flex flex-wrap gap-2 px-4">
        {chains.map((c) => (
          <RetroButton key={c.id} variant={chain === c.name ? "default" : "white"} className="!w-auto px-2 text-[12px] font-bold" onClick={() => setChain(c.name)}>{c.name}</RetroButton>
        ))}
      </div>
      <div className={`mx-4 mt-4 ${box} [&>div]:!max-w-none [&>div]:!rounded-none [&>div]:!border-0 [&>div]:!shadow-none [&_.bg-white]:!bg-secondary [&_.bg-white]:border-2 [&_.bg-white]:border-foreground`}>
        <QRCodeDisplay data={qr} title={`Scan · send on ${chain}`} description="Stablecoins land as AUSD in Free to trade." footer={<CopyCode code={depositAddress} display={`${depositAddress.slice(0, 8)}…${depositAddress.slice(-6)}`} className="w-full [&>div]:!rounded-none [&>div]:border-2 [&>div]:border-foreground" />} />
      </div>
    </>
  );
}

function StatesScreen() {
  return (
    <>
      <Title kicker="When things are weird">States</Title>
      <div className={`mx-4 ${box} space-y-3 p-4`}>
        <LoadingState label="Counting your money" variant="Dots" />
        <Skeleton className="h-12 w-3/4 rounded-none bg-foreground/10" />
        <div className="flex gap-2"><Skeleton className="h-20 flex-1 rounded-none bg-foreground/10" /><Skeleton className="h-20 flex-1 rounded-none bg-foreground/10" /></div>
      </div>
      <div className="mx-4 mt-5 [&>div]:!max-w-none [&>div]:!rounded-none [&>div]:!border-foreground [&>div]:!bg-card [&>div]:!p-8 [&>div]:shadow-hard">
        <EmptyState title="Nothing here. Yet." description="Your first trade is one tap away. Start with $10 of gold." icons={[Layers, Flame, LineChart]} action={{ label: "Pick a market", onClick: () => {} }} />
      </div>
      <div className="mx-4 mt-5 space-y-3 [&>div]:!rounded-none [&>div]:border-2 [&>div]:!border-foreground [&>div]:shadow-hard">
        <AlertToast variant="error" styleVariant="filled" title="Card declined" description="Not enough Free to spend. Your gold bet is safe." onClose={() => {}} />
        <AlertToast variant="warning" styleVariant="filled" title="Market closed" description="NVDA reopens 9:30 ET. Close-only until then." onClose={() => {}} />
        <AlertToast variant="success" styleVariant="filled" title="$250 landed" description="From Base. Ready to trade." onClose={() => {}} />
      </div>
      <div className="mx-4 mt-5 flex items-center gap-2 font-mono text-[11px]"><Inbox className="size-4" />Empty · loading · error use the same hard-shadow box.</div>
    </>
  );
}

export function D3({ screen, alt }: { screen: Screen; alt: boolean }) {
  const body = { home: <HomeScreen />, markets: <MarketsScreen />, trade: <TicketScreen />, confirm: <TicketScreen done />, card: <CardScreen />, fund: <FundScreen />, states: <StatesScreen /> }[screen];
  return (
    <Phone theme="d3" dark={alt} nav={<Nav active={navFor[screen]} />} className="relative">
      {body}
    </Phone>
  );
}
