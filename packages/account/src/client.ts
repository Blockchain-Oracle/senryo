/**
 * `AccountClient` — the one object apps hold. It runs the ceremonies (create, discoverable sign-in, pinned unlock /
 * gate / step-up), derives the account with the frozen path, keeps only non-secret hints (plus, on native, the PRF
 * behind the OS biometric gate), and owns the `SessionManager`. It signs through `signer()` and never sends.
 */
import { decryptSecretVaultWithPasskey } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { type Address, isAddressEqual, type LocalAccount } from "viem";
import { createPasskey, getPasskey, type PromptListener, withCeremony } from "./ceremony.ts";
import { type OpenedAccount, openAccount, openAccountFromMnemonic, type Pbkdf2Sha512 } from "./derive.ts";
import { AuthError, classifyAuthError, isCeremonyError } from "./errors.ts";
import type { Flow, MeasureSink } from "./measure.ts";
import type { AccountHint, PasskeyPlatform, SecretStore, SessionSync } from "./platform/types.ts";
import type { PolicyContext } from "./policy/types.ts";
import { type Clock, SessionManager, type SessionSettings, systemClock } from "./session/manager.ts";
import { createScopedSigner, UNLOCK_PROMPT } from "./session/signer.ts";

export interface AccountClientOptions {
  rpId: string;
  passkey: PasskeyPlatform;
  store: SecretStore;
  sync?: SessionSync;
  /** Native-accelerated PBKDF2 for the BIP-39 seed (react-native-quick-crypto); omitted on web. */
  pbkdf2?: Pbkdf2Sha512;
  clock?: Clock;
  settings?: SessionSettings;
  measure?: MeasureSink;
  /** Called when a ceremony's 2nd+ prompt starts (D-029 "One more confirmation" interstitial). */
  onExtraPrompt?: (flow: Flow) => void;
}

export class AccountClient {
  readonly session: SessionManager;
  readonly #o: AccountClientOptions;
  readonly #clock: Clock;
  #hint: AccountHint | undefined;

  constructor(options: AccountClientOptions) {
    this.#o = options;
    this.#clock = options.clock ?? systemClock;
    this.session = new SessionManager({
      clock: this.#clock,
      ...(options.sync ? { sync: options.sync } : {}),
      ...(options.settings ? { settings: options.settings } : {}),
    });
  }

  get hint(): AccountHint | undefined {
    return this.#hint;
  }

  get platform(): PasskeyPlatform["kind"] {
    return this.#o.passkey.kind;
  }

  /** Reads the stored hint (no prompt): a returning user renders LOCKED instantly (F02). */
  async load(): Promise<AccountHint | undefined> {
    this.#hint = await this.#o.store.readHint();
    this.session.setIdentity(this.#hint?.address);
    return this.#hint;
  }

  /** F01 Create account: one passkey ceremony (two on some authenticators) → derive → session. */
  create(): Promise<Address> {
    return this.#flow("create", async (onPrompt) => {
      const { result, prompts } = await createPasskey(
        this.#o.passkey,
        this.#o.rpId,
        new Date(this.#clock.now()),
        onPrompt,
      );
      const credential = {
        credentialId: result.credentialId,
        ...(result.transports ? { transports: result.transports } : {}),
      };
      await this.#persistUnlock(result.credentialId, result.prfOutput);
      const opened = this.#open(result.prfOutput);
      await this.#adopt({ address: opened.address, credential, mode: "passkey", savedAt: this.#clock.now() }, opened);
      return { value: opened.address, prompts };
    });
  }

  /** F02/F08 "I already have an account": discoverable ceremony → same passkey, same address, on any device. */
  signIn(): Promise<Address> {
    return this.#flow("sign-in", async (onPrompt) => {
      const { result, prompts } = await getPasskey(this.#o.passkey, this.#o.rpId, undefined, onPrompt);
      await this.#persistUnlock(result.credentialId, result.prfOutput);
      const opened = this.#open(result.prfOutput);
      const known = this.#hint && isAddressEqual(this.#hint.address, opened.address) ? this.#hint : undefined;
      const credential = known?.credential ?? { credentialId: result.credentialId };
      await this.#adopt({ address: opened.address, credential, mode: "passkey", savedAt: this.#clock.now() }, opened);
      return { value: opened.address, prompts };
    });
  }

  /** Unlock the known account with one prompt: native biometric read, else a passkey ceremony pinned to the hint. */
  unlock(prompt: string = UNLOCK_PROMPT): Promise<void> {
    return this.#flow("unlock", async (onPrompt) => {
      const hint = this.#requireHint();
      const stored = await this.#o.store.readUnlock(prompt);
      if (stored.status === "ok") {
        const opened = this.#open(stored.prfOutput);
        if (isAddressEqual(opened.address, hint.address)) {
          this.#start(hint, opened);
          return { value: undefined, prompts: 1 };
        }
        // A stale item from another account (iOS keeps Keychain items across reinstalls): the pinned ceremony below
        // re-persists the right one (F02 "reinstall mismatch → wipe + re-persist").
        opened.session.end();
      }
      const { opened, prompts } = await this.#ceremonyOpen(hint, onPrompt);
      this.#start(hint, opened);
      return { value: undefined, prompts };
    });
  }

  /** D-037 per-trade gate on a live session: native biometric read, web pinned passkey assertion. */
  confirm(prompt: string): Promise<void> {
    return this.#flow("gate", async (onPrompt) => {
      const hint = this.#requireHint();
      const stored = await this.#o.store.readUnlock(prompt);
      if (stored.status === "ok") {
        stored.prfOutput.fill(0);
        return { value: undefined, prompts: 1 };
      }
      const { result, prompts } = await getPasskey(this.#o.passkey, this.#o.rpId, hint.credential, onPrompt);
      result.prfOutput.fill(0);
      if (result.credentialId !== hint.credential.credentialId) throw new AuthError("wrong-account");
      return { value: undefined, prompts };
    });
  }

  /**
   * Step-up: a fresh passkey ceremony pinned to the stored credential → a one-shot, unscoped signer → `end()` in
   * `finally`. For withdraw/send, card limits, phrase export, 7702, loosening settings (plan §2.4).
   */
  stepUp<T>(fn: (signer: LocalAccount) => Promise<T>): Promise<T> {
    return this.#flow("step-up", async (onPrompt) => {
      const { opened, prompts } = await this.#ceremonyOpen(this.#requireHint(), onPrompt);
      try {
        return { value: await fn(toViemAccount(opened.session)), prompts };
      } finally {
        opened.session.end();
      }
    });
  }

  /** The scoped signer `packages/chain` sends with (spec client.md `getSigner()`). */
  signer(context: () => PolicyContext): LocalAccount {
    const hint = this.#requireHint();
    return createScopedSigner({
      manager: this.session,
      address: hint.address,
      context,
      unlock: (prompt) => this.unlock(prompt),
      confirm: (prompt) => this.confirm(prompt),
      now: () => this.#clock.now(),
    });
  }

  lock(): void {
    this.session.lock("manual");
  }

  /** F09 sign out: ends the session, removes hint + gated item on this device (the passkey itself stays). */
  async signOut(): Promise<void> {
    this.session.clear(true);
    this.#hint = undefined;
    await this.#o.store.clear();
  }

  /** Replace the hint (vault recovery adopts a different credential for the same address). */
  async adoptHint(hint: AccountHint, opened: OpenedAccount): Promise<void> {
    await this.#adopt(hint, opened);
  }

  /** @internal for recovery.ts */
  get options(): AccountClientOptions {
    return this.#o;
  }

  /** @internal for recovery.ts: counted flow wrapper with measurement. */
  run<T>(flow: Flow, body: (onPrompt: PromptListener) => Promise<{ value: T; prompts: number }>): Promise<T> {
    return this.#flow(flow, body);
  }

  #requireHint(): AccountHint {
    if (!this.#hint) throw new AuthError("no-credentials");
    return this.#hint;
  }

  #open(prfOutput: Uint8Array): OpenedAccount {
    return openAccount(prfOutput, this.#o.pbkdf2 ? { pbkdf2: this.#o.pbkdf2 } : {});
  }

  /** Pinned ceremony (or vault decrypt) → the hinted account; a different passkey is refused, never adopted. */
  async #ceremonyOpen(hint: AccountHint, onPrompt: PromptListener) {
    let opened: OpenedAccount;
    let prompts: number;
    if (hint.mode === "vault" && hint.vault) {
      const vault = hint.vault;
      const out = await withCeremony(this.#o.passkey, onPrompt, (c) =>
        decryptSecretVaultWithPasskey({ rpId: this.#o.rpId, vault, ...c }),
      );
      const phrase = new TextDecoder().decode(out.result);
      out.result.fill(0);
      opened = openAccountFromMnemonic(phrase, this.#o.pbkdf2 ? { pbkdf2: this.#o.pbkdf2 } : {});
      prompts = out.prompts;
    } else {
      const out = await getPasskey(this.#o.passkey, this.#o.rpId, hint.credential, onPrompt);
      if (this.#o.store.kind === "native") await this.#persistUnlock(out.result.credentialId, out.result.prfOutput);
      opened = this.#open(out.result.prfOutput);
      prompts = out.prompts;
    }
    if (!isAddressEqual(opened.address, hint.address)) {
      opened.session.end();
      throw new AuthError("wrong-account");
    }
    return { opened, prompts };
  }

  async #persistUnlock(credentialId: string, prfOutput: Uint8Array): Promise<void> {
    if (!(await this.#o.store.canPersistUnlock())) return;
    await this.#o.store.storeUnlock(credentialId, prfOutput);
  }

  async #adopt(hint: AccountHint, opened: OpenedAccount): Promise<void> {
    try {
      await this.#o.store.writeHint(hint);
    } catch (error) {
      opened.session.end();
      throw error;
    }
    this.#hint = hint;
    this.#start(hint, opened);
  }

  #start(hint: AccountHint, opened: OpenedAccount): void {
    if (!isAddressEqual(opened.address, hint.address)) {
      opened.session.end();
      throw new AuthError("wrong-account");
    }
    this.session.start(hint.address, opened.session);
  }

  async #flow<T>(flow: Flow, body: (onPrompt: PromptListener) => Promise<{ value: T; prompts: number }>): Promise<T> {
    const started = this.#clock.now();
    const onPrompt: PromptListener = (ceremony, index) => {
      this.#o.measure?.({ type: "prompt", flow, ceremony, index, at: this.#clock.now() });
      if (index > 1) this.#o.onExtraPrompt?.(flow);
    };
    try {
      const { value, prompts } = await body(onPrompt);
      this.#measureFlow(flow, "ok", prompts, started);
      return value;
    } catch (error) {
      const kind = classifyAuthError(error);
      this.#measureFlow(flow, kind === "cancelled" ? "cancelled" : "failed", 0, started, kind);
      throw isCeremonyError(error) ? new AuthError(kind, { cause: error }) : error;
    }
  }

  #measureFlow(flow: Flow, outcome: "ok" | "failed" | "cancelled", prompts: number, started: number, failure?: string) {
    const at = this.#clock.now();
    this.#o.measure?.({ type: "flow", flow, outcome, prompts, ms: at - started, ...(failure ? { failure } : {}), at });
  }
}
