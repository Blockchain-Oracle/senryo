"use client";
/**
 * The replay on the web (Q3, D-350, D-352; Codex direction 18 §B; the phone's `ReplaySheet`): the whole 4:5 film as
 * you'll post it (at most 480 px tall, and never taller than the window allows), one transport row (Play / Pause, the
 * scrubber, "0:04 / 0:14", the sound on or off; Space, arrows, Home / End on the film), one status line, and Share
 * and Save as action circles. It opens paused on the last frame. The MP4 is made, always with its sound, as soon as
 * everything is drawn (waiting while the preview plays); once it exists, Play plays its own soundtrack in step with the
 * picture, and the speaker mutes the preview. Hidden balances
 * cancel the file and silence it; a browser that can't encode H.264 plays the film but can't save it.
 */
import { FILM_COLOURS, filmSceneOf, FILM_LAYOUT as L, type ReceiptFilm } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { useProfile } from "@senryo/query";
import { Download, Share2 } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/identity/avatar";
import { EntityMark } from "@/components/identity/entity-mark";
import { ActionCircle, ActionCircles } from "@/components/ui/action-circle";
import { Modal } from "@/components/ui/modal";
import { imageFrom, svgImage } from "@/features/receipts/slip-png";
import { useAppTrader } from "@/lib/account/guest";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { setPrivacy, usePrivacy } from "@/lib/shell/privacy";
import { drawFilmFrame, type FilmFaces, type FilmImagesWeb } from "./drawFilm";
import { downloadVideo, exportFilm, shareVideo, VideoUnavailable } from "./exportFilm";
import { ReplayTransport } from "./ReplayTransport";

const PERCENT = 100;
const MS = 1_000;
const FPS = 30;
const SEEK_MS = 100;
const QR_PX = 288;
/** The preview's tallest, and what the modal's chrome takes from the window's height. */
const PREVIEW_MAX = 480;
const CHROME = 300;
const ASPECT = 1.25;

type Making =
  | { kind: "preparing" }
  | { kind: "making"; share: number }
  | { kind: "ready"; blob: Blob }
  | { kind: "unavailable" }
  | { kind: "failed" }
  | { kind: "cancelled" };

const face = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "sans-serif";

export function ReplayModal({
  film,
  url,
  open,
  onOpenChange,
}: {
  film: ReceiptFilm;
  url: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const hidden = usePrivacy();
  const trader = useAppTrader();
  const profile = useProfile(trader.owner);
  const identity = "value" in profile ? profile.value : null;
  const handle = identity?.handle ?? null;
  const scene = useMemo(() => filmSceneOf(film, handle, hidden), [film, handle, hidden]);
  const marks = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [images, setImages] = useState<FilmImagesWeb | null>(null);
  const [faces, setFaces] = useState<FilmFaces | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [making, setMaking] = useState<Making>({ kind: "preparing" });
  const [run, setRun] = useState(0);
  /** The making waits while the preview plays. */
  const [held, setHeld] = useState(false);
  const why = useRef<"cancel" | "play" | null>(null);
  const [maxH, setMaxH] = useState(PREVIEW_MAX);
  const abort = useRef<AbortController | null>(null);
  const name = `senryo-${film.input.symbol.toLowerCase()}-replay.mp4`;
  const totalMs = scene?.totalMs ?? 0;

  useEffect(() => {
    const fit = () => setMaxH(Math.max(0, Math.min(PREVIEW_MAX, window.innerHeight - CHROME)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // The images: the app's own mark and portrait (serialised SVG), the QR to the trade, the lockup.
  useEffect(() => {
    if (!open) return;
    setFaces({ sans: face("--font-inter"), display: face("--font-condensed") });
    void (async () => {
      const { toDataURL } = await import("qrcode");
      const [mark, portrait, qr, lockup] = await Promise.all([
        svgImage(marks.current?.querySelector("[data-film=mark] svg") ?? null),
        svgImage(marks.current?.querySelector("[data-film=portrait] svg") ?? null),
        imageFrom(await toDataURL(url, { margin: 4, width: QR_PX, errorCorrectionLevel: "M" })),
        imageFrom("/brand/senryo-lockup.svg"),
      ]);
      setImages({ mark, portrait, qr, lockup });
    })();
  }, [open, url]);

  useEffect(() => {
    if (scene) setT(scene.totalMs);
  }, [scene]);

  // The preview: the frame at t, drawn at the canvas's pixel size.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !scene || !faces || !images) return;
    const frame = scene.frames[Math.min(scene.frames.length - 1, Math.round((t / MS) * FPS))];
    ctx.setTransform(el.width / L.frame.w, 0, 0, el.height / L.frame.h, 0, 0);
    if (frame) drawFilmFrame(ctx, frame, scene.words, FILM_COLOURS, faces, images);
  }, [t, scene, faces, images]);

  useEffect(() => {
    if (!playing || !scene) return;
    let raf = 0;
    const start = performance.now() - (t >= scene.totalMs ? 0 : t);
    const step = (now: number) => {
      const next = Math.min(scene.totalMs, now - start);
      setT(next);
      if (next >= scene.totalMs) {
        setPlaying(false);
        setHeld(false);
      } else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, scene]);

  // The file, made from a frozen snapshot once everything is drawn, always with its sound; Retry and Make replay remake
  // it. While the preview plays the making waits (both at once would stutter the picture) and resumes after.
  useEffect(() => {
    if (!open || hidden || held || !scene || !faces || !images) return;
    void run;
    const controller = new AbortController();
    abort.current = controller;
    why.current = null;
    setMaking({ kind: "making", share: 0 });
    exportFilm(
      { ...scene, colours: FILM_COLOURS, faces, images },
      (share) => setMaking((m) => (m.kind === "making" ? { kind: "making", share } : m)),
      controller.signal,
    )
      .then((blob) => {
        if (!controller.signal.aborted) setMaking({ kind: "ready", blob });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return setMaking(why.current === "cancel" ? { kind: "cancelled" } : { kind: "preparing" });
        }
        setMaking({ kind: error instanceof VideoUnavailable ? "unavailable" : "failed" });
      });
    return () => controller.abort();
  }, [open, hidden, held, scene, faces, images, run]);

  // The preview's sound is the file's own soundtrack, muted by the speaker; none while balances are hidden.
  const ready = making.kind === "ready" ? making.blob : null;
  useEffect(() => {
    if (!ready || hidden) return;
    const src = URL.createObjectURL(ready);
    const el = new Audio(src);
    audio.current = el;
    return () => {
      el.pause();
      URL.revokeObjectURL(src);
      audio.current = null;
    };
  }, [ready, hidden]);
  useEffect(() => {
    if (audio.current) audio.current.muted = !sound;
  }, [sound, ready]);

  const pause = () => {
    audio.current?.pause();
    setPlaying(false);
    setHeld(false);
  };
  const play = () => {
    const from = t >= totalMs ? 0 : t;
    setT(from);
    const el = audio.current;
    if (el) {
      el.currentTime = from / MS;
      void el.play().catch(() => undefined);
    }
    if (making.kind === "making") {
      why.current = "play";
      setHeld(true);
    }
    setPlaying(true);
  };
  const seek = (to: number) => {
    pause();
    setT(Math.min(totalMs, Math.max(0, to)));
  };
  useEffect(() => {
    if (hidden) {
      audio.current?.pause();
      setPlaying(false);
    }
  }, [hidden]);

  // A horizontal drag on the film scrubs it, as on the phone.
  const scrubAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - box.left) / box.width) * totalMs);
  };
  const keys = (e: KeyboardEvent) => {
    const to =
      e.key === "ArrowLeft"
        ? t - SEEK_MS
        : e.key === "ArrowRight"
          ? t + SEEK_MS
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? totalMs
              : undefined;
    if (e.key === " ") {
      e.preventDefault();
      if (playing) pause();
      else play();
    } else if (to !== undefined) {
      e.preventDefault();
      seek(to);
    }
  };

  const status: { text: string; action?: { label: string; onClick: () => void } } = hidden
    ? { text: "Balances hidden", action: { label: "Show balances", onClick: () => setPrivacy(false) } }
    : !scene
      ? { text: "Replay unavailable" }
      : making.kind === "preparing"
        ? { text: "Preparing replay" }
        : making.kind === "making"
          ? {
              text: `Making replay · ${Math.round(making.share * PERCENT)}%`,
              action: {
                label: "Cancel",
                onClick: () => {
                  why.current = "cancel";
                  abort.current?.abort();
                },
              },
            }
          : making.kind === "unavailable"
            ? { text: "Can't save replay here" }
            : making.kind === "failed"
              ? { text: "Couldn't make replay", action: { label: "Retry", onClick: () => setRun((n) => n + 1) } }
              : making.kind === "cancelled"
                ? { text: "Cancelled", action: { label: "Make replay", onClick: () => setRun((n) => n + 1) } }
                : { text: "Ready" };
  const busy = !hidden && making.kind === "making";
  const blocked = ready || busy ? {} : { reason: "" };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Replay">
      <div ref={marks} aria-hidden className="pointer-events-none fixed -left-[9999em] top-0">
        <span data-film="mark">
          <EntityMark id={marketId(film.input.symbol)} size={L.market.mark} decorative />
        </span>
        <span data-film="portrait">
          <Avatar
            avatar={identity?.avatar ?? null}
            {...(trader.owner ? { address: trader.owner } : {})}
            size={L.portrait.size}
          />
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {scene ? (
          <canvas
            ref={canvas}
            width={L.frame.w}
            height={L.frame.h}
            tabIndex={0}
            onKeyDown={keys}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubAt(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) scrubAt(e);
            }}
            aria-label="Replay — Space plays, arrows seek, drag to scrub"
            style={{ height: maxH, width: maxH / ASPECT, touchAction: "pan-y" }}
            className="mx-auto rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
          />
        ) : null}
        <ReplayTransport
          t={t}
          totalMs={totalMs}
          ready={scene !== null}
          playing={playing}
          sound={sound}
          onToggle={() => (playing ? pause() : play())}
          onSeek={seek}
          onSound={() => setSound((on) => !on)}
        />
        <div className="flex min-h-8 items-center gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-meta text-muted-foreground">{status.text}</span>
            {busy && making.kind === "making" ? (
              <span className="block h-0.5 rounded-full bg-border">
                <span
                  className="block h-0.5 rounded-full bg-foreground"
                  style={{ width: `${making.share * PERCENT}%` }}
                />
              </span>
            ) : null}
          </div>
          {status.action ? (
            <button
              type="button"
              onClick={() => {
                fire("tick", { cue: "tap" });
                status.action?.onClick();
              }}
              className="text-body font-semibold text-foreground hover:underline"
            >
              {status.action.label}
            </button>
          ) : null}
        </div>
        <ActionCircles>
          <ActionCircle
            icon={<Share2 aria-hidden />}
            label="Share"
            primary
            busy={busy}
            {...blocked}
            onClick={() => {
              if (!ready) return;
              fire("tick", { cue: "tap" });
              void shareVideo(ready, name, "My Senryo replay")
                .then((shared) => {
                  if (shared) return;
                  downloadVideo(ready, name);
                  void navigator.clipboard?.writeText(url);
                  notify({ title: "Downloaded — link copied", description: "This browser can't share files." });
                })
                // Closing the share sheet isn't an error.
                .catch(() => undefined);
            }}
          />
          <ActionCircle
            icon={<Download aria-hidden />}
            label="Save"
            busy={busy}
            {...blocked}
            onClick={() => {
              if (!ready) return;
              fire("tick", { cue: "tap" });
              downloadVideo(ready, name);
              notify({ title: "Downloaded" });
            }}
          />
        </ActionCircles>
      </div>
    </Modal>
  );
}
