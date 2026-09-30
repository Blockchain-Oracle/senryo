"use client";

/**
 * AccountProvider (web) — one `AccountClient` for the tab, loaded after first paint. Exposes the session snapshot, the
 * hint, and the account actions. Lifecycle (spec session-policy §2): `pagehide` locks; the idle/TTL timers live in the
 * SessionManager; BroadcastChannel keeps one live key across tabs. The rpId is `RP_ID`; any other host is refused
 * (a different host would mean different accounts), with a way out on the error screen.
 */
import {
  type AccountClient,
  type AccountHint,
  type Address,
  DEFAULT_SETTINGS,
  defaultFaceIdMode,
  type Flow,
  isLoosening,
  type LocalAccount,
  type SessionSettings,
  type SessionSnapshot,
} from "@senryo/account";
import { RP_ID } from "@senryo/config";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { loadSettings, saveSettings } from "./settings";

export type HostStatus = "ok" | "not-allowed";
export type ProviderStatus = "loading" | "ready";

export interface AccountContextValue {
  status: ProviderStatus;
  host: HostStatus;
  snapshot: SessionSnapshot;
  hint: AccountHint | undefined;
  /** Set while a ceremony's 2nd+ prompt runs (D-029 "One more confirmation"). */
  extraPrompt: Flow | undefined;
  settings: SessionSettings;
  client: AccountClient | undefined;
  create(): Promise<Address>;
  signIn(): Promise<Address>;
  unlock(): Promise<void>;
  lock(): void;
  signOut(): Promise<void>;
  stepUp<T>(fn: (signer: LocalAccount) => Promise<T>): Promise<T>;
  applySettings(next: SessionSettings): Promise<void>;
  refresh(): Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

/** WebAuthn only accepts an rpId that is the page host or a registrable suffix of it. */
export function hostAllowed(hostname: string): boolean {
  return hostname === RP_ID || hostname.endsWith(`.${RP_ID}`);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<AccountClient>();
  const [status, setStatus] = useState<ProviderStatus>("loading");
  const [host, setHost] = useState<HostStatus>("ok");
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({ status: "none" });
  const [hint, setHint] = useState<AccountHint>();
  const [extraPrompt, setExtraPrompt] = useState<Flow>();
  // Read on mount, not during prerender (no storage on the server; avoids a hydration mismatch).
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const clientRef = useRef<AccountClient | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setHost(hostAllowed(window.location.hostname) ? "ok" : "not-allowed");
    setSettings(loadSettings());
    void import("./runtime").then(async ({ createWebAccountClient }) => {
      const c = createWebAccountClient(loadSettings(), (flow) => setExtraPrompt(flow));
      const loaded = await c.load();
      if (!live) return c.session.dispose();
      clientRef.current = c;
      setClient(c);
      setHint(loaded);
      setSnapshot(c.session.snapshot());
      setStatus("ready");
    });
    return () => {
      live = false;
      clientRef.current?.session.dispose();
    };
  }, []);

  useEffect(() => {
    if (!client) return;
    const sync = () => setSnapshot(client.session.snapshot());
    const unsubscribe = client.session.subscribe(sync);
    // The page is going away (or into the bfcache): zero the key now rather than waiting for GC.
    const onPageHide = () => client.session.lock("background");
    window.addEventListener("pagehide", onPageHide);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [client]);

  const need = useCallback((): AccountClient => {
    const c = clientRef.current;
    if (!c) throw new Error("Account runtime is still loading");
    return c;
  }, []);

  /** Runs a ceremony flow and refreshes the hint; the interstitial flag always clears. */
  const flow = useCallback(
    async <T,>(run: (c: AccountClient) => Promise<T>): Promise<T> => {
      const c = need();
      try {
        return await run(c);
      } finally {
        setExtraPrompt(undefined);
        setHint(c.hint);
      }
    },
    [need],
  );

  const applySettings = useCallback(
    async (next: SessionSettings) => {
      const c = need();
      const networkDefault = defaultFaceIdMode(ACTIVE_NETWORK.key);
      if (isLoosening(c.session.settings, next, networkDefault)) await c.stepUp(async () => undefined);
      c.session.applySettings(next);
      saveSettings(next);
      setSettings(next);
    },
    [need],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      status,
      host,
      snapshot,
      hint,
      extraPrompt,
      settings,
      client,
      create: () => flow((c) => c.create()),
      signIn: () => flow((c) => c.signIn()),
      unlock: () => flow((c) => c.unlock()),
      lock: () => clientRef.current?.lock(),
      signOut: () => flow((c) => c.signOut()),
      stepUp: (fn) => flow((c) => c.stepUp(fn)),
      applySettings,
      refresh: async () => {
        setHint(await need().load());
      },
    }),
    [status, host, snapshot, hint, extraPrompt, settings, client, flow, applySettings, need],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount outside <AccountProvider>");
  return value;
}
