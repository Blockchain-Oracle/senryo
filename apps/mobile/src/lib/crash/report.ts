/**
 * What went wrong on this phone, kept and sent (D0, 13 Oct: the owner's iPhone crashed switching modes and left no
 * trace). A JS error — from the root error boundary or the global handler — is written to storage at once, because a
 * fatal one ends the app a moment later; a run that ended without ever reaching the background (a native crash, or the
 * system killing it) is noted on the next launch as an unclean exit, with the screen it was on. Everything kept goes to
 * `POST /v1/events` on the next launch, tagged with the version, the runtime and the update, and is dropped once
 * accepted. No addresses or amounts: the message, the trimmed stack, the screen and the network.
 */
import { eventsRoute } from "@senryo/api-client";
import * as Updates from "expo-updates";
import { AppState, Platform } from "react-native";
import { api } from "~/lib/account/api";
import { APP } from "~/lib/constants/app";
import { activeNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** Kept at most: the newest errors win. */
const QUEUE_MAX = 10;
/** The api drops a report's props whole above 2,048 characters: the stack is trimmed to fit with the rest. */
const STACK_MAX = 1_200;
const MESSAGE_MAX = 300;
const SCREEN_MAX = 120;

type Props = Record<string, string | boolean | number>;
interface Kept {
  name: "app_error" | "app_unclean_exit" | "app_updates_error";
  at: string;
  props: Props;
}
interface Session {
  open: boolean;
  screen: string;
  at: string;
}

interface ErrorUtilsLike {
  getGlobalHandler(): (error: unknown, fatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, fatal?: boolean) => void): void;
}

let screen = "";
let started = false;

const read = <T>(key: string): T | undefined => {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
};

function tags(): Props {
  return {
    runtime: Updates.runtimeVersion ?? "",
    update: Updates.updateId ?? "",
    embedded: Updates.isEmbeddedLaunch,
    network: activeNetwork().key,
    screen: screen.slice(0, SCREEN_MAX),
  };
}

function keep(report: Kept): void {
  const queue = read<Kept[]>(STORAGE_KEYS.crashQueue) ?? [];
  storage.set(STORAGE_KEYS.crashQueue, JSON.stringify([...queue, report].slice(-QUEUE_MAX)));
}

function writeSession(open: boolean): void {
  storage.set(
    STORAGE_KEYS.crashSession,
    JSON.stringify({ open, screen, at: new Date().toISOString() } satisfies Session),
  );
}

/** An error the app caught or is about to die of. Synchronous: it must be on disk before a fatal error ends the run. */
export function recordError(error: unknown, where: "boundary" | "global", fatal: boolean): void {
  const e = error instanceof Error ? error : new Error(String(error));
  keep({
    name: "app_error",
    at: new Date().toISOString(),
    props: {
      ...tags(),
      where,
      fatal,
      message: `${e.name}: ${e.message}`.slice(0, MESSAGE_MAX),
      stack: (e.stack ?? "").slice(0, STACK_MAX),
    },
  });
}

/** The route the user is on, kept with the session so an unclean exit says where it happened. */
export function noteScreen(path: string): void {
  screen = path;
  if (started) writeSession(AppState.currentState === "active");
}

/** The updater's own errors over this long are read at launch (it recovers a JS crash by reloading — no crash file). */
const UPDATES_LOG_MS = 86_400_000;
const UPDATES_ERRORS = new Set(["error", "fatal"]);

/**
 * expo-updates logs what it recovered from — a JS error that reloaded the app, an update that failed to launch — and a
 * reload leaves no crash report on the phone (13 Oct: the owner's "crash" left none). Its errors since the last read
 * join the queue, once each.
 */
async function keepUpdaterErrors(): Promise<void> {
  try {
    const since = Number(storage.getString(STORAGE_KEYS.crashUpdatesSeen) ?? "0");
    const entries = (await Updates.readLogEntriesAsync(UPDATES_LOG_MS)).filter(
      (e) => UPDATES_ERRORS.has(e.level) && e.timestamp > since,
    );
    for (const e of entries) {
      keep({
        name: "app_updates_error",
        at: new Date(e.timestamp).toISOString(),
        props: {
          ...tags(),
          code: e.code,
          level: e.level,
          message: e.message.slice(0, MESSAGE_MAX),
          stack: (e.stacktrace ?? []).join("\n").slice(0, STACK_MAX),
          ...(e.updateId ? { failedUpdate: e.updateId } : {}),
        },
      });
    }
    const newest = Math.max(since, ...entries.map((e) => e.timestamp));
    storage.set(STORAGE_KEYS.crashUpdatesSeen, String(newest));
  } catch {
    // Not available (a development build): nothing to add.
  }
}

async function send(): Promise<void> {
  const queue = read<Kept[]>(STORAGE_KEYS.crashQueue) ?? [];
  if (queue.length === 0) return;
  try {
    await api().call(eventsRoute, {
      body: { platform: Platform.OS === "android" ? "android" : "ios", appVersion: APP.version, events: queue },
    });
    storage.remove(STORAGE_KEYS.crashQueue);
  } catch {
    // Kept for the next launch: a report is never worth an error of its own.
  }
}

/** Once, at launch: last run's ending, the global handler, the session flag, and sending what was kept. */
export function startCrashWatch(): void {
  if (started) return;
  started = true;
  const last = read<Session>(STORAGE_KEYS.crashSession);
  if (last?.open) {
    keep({ name: "app_unclean_exit", at: last.at, props: { ...tags(), screen: last.screen.slice(0, SCREEN_MAX) } });
  }
  writeSession(true);
  AppState.addEventListener("change", (state) => writeSession(state === "active"));
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (utils) {
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, fatal) => {
      recordError(error, "global", fatal === true);
      previous(error, fatal);
    });
  }
  if (Updates.isEmergencyLaunch) {
    keep({
      name: "app_updates_error",
      at: new Date().toISOString(),
      props: {
        ...tags(),
        code: "EmergencyLaunch",
        message: (Updates.emergencyLaunchReason ?? "").slice(0, MESSAGE_MAX),
      },
    });
  }
  void keepUpdaterErrors().then(send);
}
