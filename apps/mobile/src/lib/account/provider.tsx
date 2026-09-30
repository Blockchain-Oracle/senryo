/**
 * AccountProvider (native) — one `AccountClient` for the app. A returning user renders from the ungated hint with no
 * prompt (F02); the first signing action unlocks with one biometric read. Lifecycle (spec session-policy §2): AppState
 * `background` locks (zeroes the key); `inactive` raises the privacy plate over the app switcher snapshot.
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
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { clearApiSession } from "./api";
import { pullPrefs, pushPrefs } from "./remote";
import { createNativeAccountClient } from "./runtime";
import { loadSettings, saveSettings } from "./settings";

export interface AccountContextValue {
  ready: boolean;
  snapshot: SessionSnapshot;
  hint: AccountHint | undefined;
  /** Set while a ceremony's 2nd+ prompt runs (D-029 "One more confirmation"). */
  extraPrompt: Flow | undefined;
  settings: SessionSettings;
  /** The app is not in the foreground: cover it (app-switcher privacy plate). */
  obscured: boolean;
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

export function AccountProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const [extraPrompt, setExtraPrompt] = useState<Flow>();
  const [client] = useState(() => createNativeAccountClient(loadSettings(), (flow) => setExtraPrompt(flow)));
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(client.session.snapshot());
  const [hint, setHint] = useState<AccountHint>();
  const [obscured, setObscured] = useState(false);
  const clientRef = useRef(client);

  useEffect(() => {
    setSettings(loadSettings());
    const unsubscribe = client.session.subscribe(() => setSnapshot(client.session.snapshot()));
    // A failed read never strands the app on a loader: no hint is the normal (stateless) path.
    void client
      .load()
      .catch(() => undefined)
      .then((h) => {
        setHint(h);
        setSnapshot(client.session.snapshot());
        setReady(true);
      });
    const sub = AppState.addEventListener("change", (state) => {
      setObscured(state !== "active");
      // Backgrounded: end the signing session now (Mera: "end the session when the app's session expires"); the
      // ticket and the portfolio survive, the next trade asks for Face ID once.
      if (state === "background") client.session.lock("background");
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [client]);

  const flow = useCallback(async <T,>(run: (c: AccountClient) => Promise<T>): Promise<T> => {
    const c = clientRef.current;
    try {
      const out = await run(c);
      // Any account on the device skips the first-run welcome next launch (no-flash gate in app/index.tsx).
      if (c.hint) storage.set(STORAGE_KEYS.welcomed, true);
      return out;
    } finally {
      setExtraPrompt(undefined);
      setHint(c.hint);
    }
  }, []);

  const adopt = useCallback((next: SessionSettings) => {
    clientRef.current.session.applySettings(next);
    saveSettings(next);
    setSettings(next);
  }, []);

  // Encrypted prefs sync (S6.12): on each unlock, adopt the synced settings when they are at least as strict as ours.
  const unlockedAs = snapshot.status === "unlocked" ? snapshot.address : undefined;
  useEffect(() => {
    const c = clientRef.current;
    if (!unlockedAs) return;
    pullPrefs(c, c.session.settings)
      .then((synced) => synced && adopt(synced))
      // Offline or no API: this phone's settings stand; the next unlock tries again.
      .catch(() => undefined);
  }, [unlockedAs, adopt]);

  const applySettings = useCallback(
    async (next: SessionSettings) => {
      const c = clientRef.current;
      if (isLoosening(c.session.settings, next, defaultFaceIdMode(ACTIVE_NETWORK.key))) {
        await c.stepUp(async () => undefined);
      }
      adopt(next);
      void pushPrefs(c, next).catch(() => undefined);
    },
    [adopt],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      ready,
      snapshot,
      hint,
      extraPrompt,
      settings,
      obscured,
      client: ready ? client : undefined,
      create: () => flow((c) => c.create()),
      signIn: () => flow((c) => c.signIn()),
      unlock: () => flow((c) => c.unlock()),
      lock: () => client.lock(),
      signOut: () =>
        flow(async (c) => {
          await c.signOut();
          clearApiSession();
        }),
      stepUp: (fn) => flow((c) => c.stepUp(fn)),
      applySettings,
      refresh: async () => {
        setHint(await client.load());
      },
    }),
    [ready, snapshot, hint, extraPrompt, settings, obscured, client, flow, applySettings],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount outside <AccountProvider>");
  return value;
}
