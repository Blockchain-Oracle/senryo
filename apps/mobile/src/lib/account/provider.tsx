/**
 * AccountProvider (native) — one `AccountClient` for the app. A returning user renders from the ungated hint with no
 * prompt (F02); the first signing action unlocks with one biometric read. Lifecycle (spec session-policy §2): AppState
 * `background` locks (zeroes the key); `inactive` raises the privacy plate over the app switcher snapshot — except
 * under a system sheet the app raised itself.
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
  type PendingSignIn,
  type SessionSettings,
  type SessionSnapshot,
} from "@senryo/account";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { beginCreate, endCreate, oweSetup, reconcileCreate } from "~/features/setup/progress";
import { activeNetwork } from "~/lib/network";
import { unregisterPush } from "~/lib/notifications/push";
import { clearApiSession } from "./api";
import { rememberAccount } from "./identity-cache";
import { pullPrefs, pushPrefs } from "./remote";
import { createNativeAccountClient } from "./runtime";
import { loadSettings, saveSettings } from "./settings";
import { systemPromptUp } from "./system-prompt";

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
  /** A2: one passkey makes the account; its setup is owed from the moment the passkey succeeds. */
  create(): Promise<Address>;
  signIn(): Promise<Address>;
  /** A3: the passkey picker, without adopting what it opened yet (check it, then adopt or discard). */
  openSignIn(): Promise<PendingSignIn>;
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
        // A create killed after its passkey succeeded still owes its setup (defect 6).
        reconcileCreate(h?.address);
        setHint(h);
        setSnapshot(client.session.snapshot());
        setReady(true);
      });
    const sub = AppState.addEventListener("change", (state) => {
      // `inactive` under a sheet the app raised itself (passkey, Face ID) is not "away": no plate behind a prompt.
      setObscured(state === "background" || (state === "inactive" && !systemPromptUp()));
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
      if (isLoosening(c.session.settings, next, defaultFaceIdMode(activeNetwork().key))) {
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
      create: () =>
        flow(async (c) => {
          beginCreate(c.hint?.address);
          try {
            const address = await c.create();
            oweSetup(address);
            rememberAccount(address);
            return address;
          } finally {
            endCreate();
          }
        }),
      signIn: () =>
        flow(async (c) => {
          const address = await c.signIn();
          rememberAccount(address);
          return address;
        }),
      openSignIn: () =>
        flow(async (c) => {
          const pending = await c.openDiscoverable();
          return {
            address: pending.address,
            adopt: async () => {
              try {
                const address = await pending.adopt();
                rememberAccount(address);
                return address;
              } finally {
                setHint(c.hint);
              }
            },
            discard: pending.discard,
          };
        }),
      unlock: () => flow((c) => c.unlock()),
      lock: () => client.lock(),
      signOut: () =>
        flow(async (c) => {
          // Pushes for this account stop reaching the phone. Locked, it is forgotten here only (no prompt on sign-out).
          await unregisterPush(c, settings.faceId, snapshot.status === "unlocked");
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
