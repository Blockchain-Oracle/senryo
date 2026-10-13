"use client";
/**
 * ⌘K (R6, Codex direction 13; 21st.dev 382 originui/command → cmdk with our own ranking, 31354 wensity's nested pages
 * and footer): one search over Senryo — a top hit, then groups by their best hit; with nothing typed, Recent, your
 * positions, Hot · 24 h and Go to (keys 1–5 after Tab). ↵ opens, ⌘↵ / Ctrl+↵ is the kind's alternate, named in the
 * footer; a market's chevron or ⌘↵ opens its page. ≥ 1024 px a preview pane inspects the highlighted result. It never
 * executes a trade, and the terminal's keys rest while it's open (a dialog blocks them).
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MARKETS } from "@senryo/config";
import { marketId } from "@senryo/identity";
import { lookupKeys } from "@senryo/query";
import { type SearchEntry, shortHash } from "@senryo/search";
import { useQueryClient } from "@tanstack/react-query";
import { Command } from "cmdk";
import { ChevronLeft, LoaderCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { useAppTrader } from "@/lib/account/guest";
import { WIDE_QUERY } from "@/lib/constants/layout";
import { fire } from "@/lib/feedback";
import { useModKey } from "@/lib/platform";
import { setSearchOpen, useSearchOpen } from "@/lib/shell/search-open";
import { useMediaQuery } from "@/lib/use-media-query";
import { MarketPage, type MarketPageState } from "./MarketPage";
import { Preview } from "./Preview";
import { ResultRow } from "./Rows";
import { alternateOf, GO_TO, useWebSearch } from "./useWebSearch";
import "./search.css";
import "./search-pane.css";

const CRUMB_MARK = 28;
const DIGIT = /^[1-9]$/;

/** The market a page belongs to, for its preview (Codex: the page keeps the preview). */
const pageEntry = (symbol: string): SearchEntry => ({
  id: `market:${symbol}`,
  group: "markets",
  title: symbol,
  target: { kind: "terminal", intent: { symbol } },
});

export function SearchPalette() {
  const router = useRouter();
  const client = useQueryClient();
  const open = useSearchOpen() === true;
  const guest = useAppTrader().guest;
  const mod = useModKey();
  const wide = useMediaQuery(WIDE_QUERY);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const [page, setPage] = useState<MarketPageState | null>(null);
  const [pageQuery, setPageQuery] = useState("");
  const root = useRef<{ query: string; value: string }>({ query: "", value: "" });
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  /** Opening a result closes the palette without its own cue (the result's cue plays). */
  const silent = useRef(false);
  const search = useWebSearch(query, open);

  const entries = useMemo(() => search.sections.flatMap((s) => s.hits.map((h) => h.entry)), [search.sections]);
  const highlighted = entries.find((e) => e.id === value);
  const digits = useMemo(() => new Map(GO_TO.map((key, i) => [`place:${key}`, String(i + 1)])), []);

  const reset = () => {
    setQuery("");
    setValue("");
    setPage(null);
    setPageQuery("");
  };
  const setOpen = (next: boolean) => {
    if (next) fire("press", { cue: "sheetOpen" });
    else if (!silent.current) fire("tick", { cue: "sheetClose" });
    silent.current = false;
    if (!next) reset();
    setSearchOpen(next);
  };
  const leave = () => {
    fire("press", { cue: "tap" });
    silent.current = true;
    setOpen(false);
  };
  const openPage = (next: MarketPageState) => {
    fire("tick", { cue: "tap" });
    root.current = { query, value };
    setPage(next);
    setPageQuery("");
    setValue("page:up");
    requestAnimationFrame(() => input.current?.focus());
  };
  const back = () => {
    fire("tick");
    setPage(null);
    setQuery(root.current.query);
    setValue(root.current.value);
    requestAnimationFrame(() => input.current?.focus());
  };
  const choose = (id: string, alternate: boolean) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    if (alternate && alternateOf(entry) === null) return;
    const next = search.run(entry, alternate);
    if (next) openPage(next.marketPage);
    else leave();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!page) choose(value, true);
      return;
    }
    if (e.key === "Backspace" && page && pageQuery === "" && document.activeElement === input.current) {
      e.preventDefault();
      back();
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && document.activeElement === input.current) {
      e.preventDefault();
      list.current?.focus();
      return;
    }
    if (e.key === "Tab" && e.shiftKey && document.activeElement === list.current) {
      e.preventDefault();
      input.current?.focus();
      return;
    }
    if (document.activeElement === list.current && DIGIT.test(e.key)) {
      const key = GO_TO[Number(e.key) - 1];
      if (key) {
        e.preventDefault();
        choose(`place:${key}`, false);
      }
    }
  };

  const alternate = highlighted ? alternateOf(highlighted) : null;
  const lookup = search.lookup;
  const noMatch = !page && !search.empty && search.sections.length === 0 && lookup.state === "idle";
  const pageMarket = page ? MARKETS.find((m) => m.symbol === page.symbol) : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="search-backdrop" />
        <DialogPrimitive.Content
          className="search-panel"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (!page) return;
            e.preventDefault();
            back();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Search Senryo</DialogPrimitive.Title>
          <Command
            label="Search Senryo"
            shouldFilter={false}
            loop
            vimBindings={false}
            value={value}
            onValueChange={setValue}
            onKeyDown={onKeyDown}
            className="search-command"
          >
            {page ? (
              <div className="search-crumbs">
                <button type="button" className="search-back" aria-label="Back to search" onClick={back}>
                  <ChevronLeft aria-hidden />
                </button>
                <button type="button" className="search-crumb" onClick={back}>
                  Search
                </button>
                <span aria-hidden>/</span>
                <span className="search-crumb is-here">{page.symbol}</span>
                <EntityMark id={marketId(page.symbol)} size={CRUMB_MARK} decorative />
              </div>
            ) : null}
            <div className="search-field">
              {page ? null : (
                <DialogPrimitive.Close className="search-exit" aria-label="Back">
                  <ChevronLeft aria-hidden />
                </DialogPrimitive.Close>
              )}
              {page ? null : <Search aria-hidden className="search-field-icon" />}
              <Command.Input
                ref={input}
                value={page ? pageQuery : query}
                onValueChange={page ? setPageQuery : setQuery}
                placeholder={page ? `Search ${page.symbol} actions` : "Search markets, positions, anything"}
                aria-label={page ? `Search ${pageMarket?.name ?? page.symbol} actions` : "Search Senryo"}
                autoFocus
              />
              {(page ? pageQuery : query) ? (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    fire("tick");
                    if (page) setPageQuery("");
                    else setQuery("");
                    input.current?.focus();
                  }}
                >
                  <X aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="search-body">
              <Command.List ref={list} tabIndex={-1} className="search-list">
                {page ? (
                  <MarketPage
                    page={page}
                    query={pageQuery}
                    onLane={(lane) => {
                      setPage({ ...page, lane });
                      setValue("page:up");
                    }}
                    onOpen={(intent) => {
                      search.go({ kind: "terminal", intent });
                      leave();
                    }}
                    onProof={(symbol) => {
                      router.push(`/proof/?market=${symbol}`);
                      leave();
                    }}
                  />
                ) : (
                  <>
                    {lookup.state === "looking" ? (
                      <div className="search-note" role="status">
                        <LoaderCircle aria-hidden className="search-spin" />
                        Finding receipt…{" "}
                        {lookup.id.kind === "hash"
                          ? `Transaction ${shortHash(lookup.id.value)}`
                          : `#${lookup.id.value}`}
                      </div>
                    ) : lookup.state === "none" && lookup.id.kind === "number" ? (
                      <div className="search-note" role="status">
                        No receipt found for {lookup.id.of === "ride" ? "Ride" : lookup.id.of === "call" ? "Call" : ""}{" "}
                        #{lookup.id.value}
                      </div>
                    ) : lookup.state === "failed" ? (
                      <div className="search-note" role="alert">
                        Couldn't look up this receipt.
                        <button
                          type="button"
                          className="search-link"
                          onClick={() => void client.invalidateQueries({ queryKey: lookupKeys.all })}
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}
                    {search.empty && !search.sections.some((s) => s.key === "recent") ? (
                      <p className="search-quiet">Your recent visits appear here.</p>
                    ) : null}
                    {search.sections.map((s) => (
                      <Command.Group
                        key={s.key}
                        heading={
                          <span className="search-heading">
                            {s.label}
                            {s.key === "places" && search.empty ? <small>Tab to use 1–5</small> : null}
                          </span>
                        }
                      >
                        {s.hits.map(({ entry }) => {
                          const digit = digits.get(entry.id);
                          return (
                            <ResultRow
                              key={entry.id}
                              entry={entry}
                              {...(digit ? { digit } : {})}
                              onSelect={() => choose(entry.id, false)}
                              onOptions={(symbol) => openPage({ symbol })}
                            />
                          );
                        })}
                        {s.more ? (
                          <Command.Item
                            value="more:positions"
                            onSelect={() => {
                              router.push("/app/calls/");
                              leave();
                            }}
                            className="search-row is-compact"
                          >
                            <span className="search-title">View all {(s.more ?? 0) + s.hits.length} positions</span>
                          </Command.Item>
                        ) : null}
                      </Command.Group>
                    ))}
                    {search.empty && !guest && !search.sections.some((s) => s.key === "positions") ? (
                      <p className="search-quiet">No open positions.</p>
                    ) : null}
                    {noMatch ? (
                      <div className="search-none" role="status">
                        <p className="search-none-title">No matches for “{query}”</p>
                        <p className="search-sub">Try a symbol, team, game, or receipt ID.</p>
                        <button
                          type="button"
                          className="search-link"
                          onClick={() => {
                            setQuery("");
                            input.current?.focus();
                          }}
                        >
                          Clear search
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </Command.List>
              {wide ? <Preview entry={page ? pageEntry(page.symbol) : highlighted} /> : null}
            </div>
            <footer className="search-footer" aria-hidden>
              <span>
                <kbd>↵</kbd> Open
              </span>
              {!page && alternate ? (
                <span>
                  <kbd>{mod === "⌘" ? "⌘↵" : "Ctrl+↵"}</kbd> {alternate}
                </span>
              ) : null}
              <span>
                <kbd>↑↓</kbd> Move
              </span>
              <span>
                <kbd>esc</kbd> {page ? "Back" : "Close"}
              </span>
            </footer>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
