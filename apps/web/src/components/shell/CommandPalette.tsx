"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
// ⌘K (pivot S6.4): 21st.dev 382 originui/command (cmdk over the Radix Dialog the modal already uses), in a centred
// modal (D-190). Live markets first — the real mark, the price as it streams, the 1-minute window's countdown — then the
// places, every Everything destination, and the actions (hide balances, sound, haptics, theme). Loaded on first open.
import { unitOf } from "@senryo/calls";
import { CADENCES_SEC, LOCKOUT_SEC } from "@senryo/config";
import { clockText, formatPrice, laneLabel, priceFromE8, windowCountdown } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice, useServerSeconds } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { Command } from "cmdk";
import { Eye, EyeOff, Moon, Search, Sun, Vibrate, VibrateOff, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { fire, setFeedback, tapFeedback, useFeedback } from "@/lib/feedback";
import { setPrivacy, usePrivacy } from "@/lib/shell/privacy";
import { EVERYTHING, NAV_ICON, RAIL } from "./nav";

const MARK = 28;
const FIRST_CADENCE = CADENCES_SEC[0];

/** Every typed word must appear in the row's words (cmdk's default fuzzy score matches scattered letters). */
function matches(value: string, search: string, keywords: string[] = []): number {
  const hay = `${value} ${keywords.join(" ")}`.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word))
    ? 1
    : 0;
}

function Row({
  value,
  keywords = [],
  onSelect,
  children,
}: {
  value: string;
  keywords?: string[];
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Command.Item value={value} keywords={keywords} onSelect={onSelect} className="command-item">
      {children}
    </Command.Item>
  );
}

function MarketRow({ symbol, name, onOpen }: { symbol: string; name: string; onOpen: () => void }) {
  const priceE8 = useLivePrice(symbol);
  const now = useServerSeconds();
  const w = windowCountdown(now, FIRST_CADENCE, LOCKOUT_SEC);
  return (
    <Row value={`market ${symbol}`} keywords={[symbol, name, "trade", "call"]} onSelect={onOpen}>
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <span className="command-copy">
        <strong>{symbol}</strong>
        <small>
          {name} · {laneLabel(FIRST_CADENCE)}{" "}
          {w.open ? `closes in ${clockText(w.closesIn)}` : `reopens in ${clockText(w.endsIn)}`}
        </small>
      </span>
      <span className="command-price tnum">
        {formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8), undefined, unitOf(symbol))}
      </span>
    </Row>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const catalog = useCatalog();
  const feedback = useFeedback();
  const hidden = usePrivacy();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const close = () => {
    onOpenChange(false);
    setQuery("");
  };
  const go = (href: string) => {
    tapFeedback();
    close();
    router.push(href);
  };
  const act = (run: () => void) => () => {
    run();
    fire("tick", { cue: "tap" });
    close();
  };
  const light = resolvedTheme === "light";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="command-backdrop" />
        <DialogPrimitive.Content className="command-panel" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <Command label="Search markets, places and actions" loop filter={matches}>
            <div className="command-input">
              <Search aria-hidden />
              <Command.Input value={query} onValueChange={setQuery} placeholder="Markets, places, actions" autoFocus />
              <kbd aria-hidden>esc</kbd>
            </div>
            <Command.List className="command-list">
              <Command.Empty className="command-empty">Nothing matches “{query}”.</Command.Empty>
              {"value" in catalog ? (
                <Command.Group heading="Markets">
                  {catalog.value.markets.map((m) => (
                    <MarketRow
                      key={m.symbol}
                      symbol={m.symbol}
                      name={m.name}
                      onOpen={() => go(`/app/trade/${m.symbol.toLowerCase()}/`)}
                    />
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading="Go to">
                {RAIL.map((item) => {
                  const Icon = NAV_ICON[item.icon];
                  return (
                    <Row
                      key={item.key}
                      value={`go ${item.label}`}
                      keywords={[item.description, item.keywords ?? ""]}
                      onSelect={() => go(item.href)}
                    >
                      <Icon aria-hidden className="command-icon" />
                      <span className="command-copy">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Row>
                  );
                })}
              </Command.Group>
              {EVERYTHING.map((section) => (
                <Command.Group key={section.key} heading={section.label}>
                  {section.items.map((item) => {
                    const Icon = NAV_ICON[item.icon];
                    return (
                      <Row
                        key={item.key}
                        value={`${section.key} ${item.label}`}
                        keywords={[item.description, "keywords" in item ? item.keywords : ""]}
                        onSelect={() => go(item.href)}
                      >
                        <Icon aria-hidden className="command-icon" />
                        <span className="command-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </Row>
                    );
                  })}
                </Command.Group>
              ))}
              <Command.Group heading="Actions">
                <Row
                  value="action balances"
                  keywords={["privacy", "hide", "show"]}
                  onSelect={act(() => setPrivacy(!hidden))}
                >
                  {hidden ? (
                    <Eye aria-hidden className="command-icon" />
                  ) : (
                    <EyeOff aria-hidden className="command-icon" />
                  )}
                  <span className="command-copy">
                    <strong>{hidden ? "Show balances" : "Hide balances"}</strong>
                  </span>
                </Row>
                <Row
                  value="action sound"
                  keywords={["mute", "audio"]}
                  onSelect={act(() => setFeedback({ sound: !feedback.sound }))}
                >
                  {feedback.sound ? (
                    <VolumeX aria-hidden className="command-icon" />
                  ) : (
                    <Volume2 aria-hidden className="command-icon" />
                  )}
                  <span className="command-copy">
                    <strong>{feedback.sound ? "Turn sounds off" : "Turn sounds on"}</strong>
                  </span>
                </Row>
                <Row
                  value="action haptics"
                  keywords={["vibration"]}
                  onSelect={act(() => setFeedback({ haptics: !feedback.haptics }))}
                >
                  {feedback.haptics ? (
                    <VibrateOff aria-hidden className="command-icon" />
                  ) : (
                    <Vibrate aria-hidden className="command-icon" />
                  )}
                  <span className="command-copy">
                    <strong>{feedback.haptics ? "Turn vibration off" : "Turn vibration on"}</strong>
                  </span>
                </Row>
                <Row
                  value="action theme"
                  keywords={["dark", "light", "appearance"]}
                  onSelect={act(() => setTheme(light ? "dark" : "light"))}
                >
                  {light ? <Moon aria-hidden className="command-icon" /> : <Sun aria-hidden className="command-icon" />}
                  <span className="command-copy">
                    <strong>{light ? "Dark theme" : "Light theme"}</strong>
                  </span>
                </Row>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
