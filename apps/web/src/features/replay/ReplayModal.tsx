"use client";
/**
 * The replay video on the web (Q3, D-350; Codex direction 17 §4; the phone's `VideoSheet`): the whole 4:5 card as
 * you'll post it — opening on the poster frame, Play / Pause, a scrub (Space, arrows, Home / End) — "Sound in video",
 * and the file made as soon as it opens ("Making video 62%", Cancel), then Save video (a download) and Share video (the
 * share sheet with the file, where the browser can). Hidden balances block it; a browser that can't encode H.264 says
 * so — never a silent WebM.
 */
import { FILM_COLOURS, filmSceneOf, FILM_LAYOUT as L, type ReceiptFilm } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { useProfile } from "@senryo/query";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/identity/avatar";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SwitchRow } from "@/components/ui/switch-row";
import { imageFrom, svgImage } from "@/features/receipts/slip-png";
import { useAppTrader } from "@/lib/account/guest";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { usePrivacy } from "@/lib/shell/privacy";
import { drawFilmFrame, type FilmFaces, type FilmImagesWeb } from "./drawFilm";
import { downloadVideo, exportFilm, shareVideo, VideoUnavailable } from "./exportFilm";

const PERCENT = 100;
const MS = 1_000;
const FPS = 30;
const SEEK_MS = 100;
const QR_PX = 288;

type Making =
  | { kind: "idle" }
  | { kind: "making"; share: number }
  | { kind: "ready"; blob: Blob }
  | { kind: "unavailable" }
  | { kind: "failed" };

const face = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "sans-serif";

export function VideoModal({
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
  const [images, setImages] = useState<FilmImagesWeb | null>(null);
  const [faces, setFaces] = useState<FilmFaces | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [making, setMaking] = useState<Making>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  const name = `senryo-${film.input.symbol.toLowerCase()}-replay.mp4`;

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
      if (next >= scene.totalMs) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, scene]);

  // The file, made from a frozen snapshot once everything is drawn; sound on or off makes it again.
  useEffect(() => {
    if (!open || hidden || !scene || !faces || !images) return;
    const controller = new AbortController();
    abort.current = controller;
    setMaking({ kind: "making", share: 0 });
    exportFilm(
      { ...scene, colours: FILM_COLOURS, faces, images, sound },
      (share) => setMaking((m) => (m.kind === "making" ? { kind: "making", share } : m)),
      controller.signal,
    )
      .then((blob) => {
        if (!controller.signal.aborted) setMaking({ kind: "ready", blob });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMaking({ kind: error instanceof VideoUnavailable ? "unavailable" : "failed" });
      });
    return () => controller.abort();
  }, [open, hidden, scene, faces, images, sound]);

  const ready = making.kind === "ready" ? making.blob : null;
  const keys = (e: KeyboardEvent) => {
    if (!scene) return;
    const to =
      e.key === " "
        ? null
        : e.key === "ArrowLeft"
          ? t - SEEK_MS
          : e.key === "ArrowRight"
            ? t + SEEK_MS
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? scene.totalMs
                : undefined;
    if (to === undefined) return;
    e.preventDefault();
    if (to === null) setPlaying((p) => !p);
    else {
      setPlaying(false);
      setT(Math.min(scene.totalMs, Math.max(0, to)));
    }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Replay video">
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
            aria-label="Replay video preview — Space plays, arrows seek"
            className="aspect-[4/5] w-full rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
          />
        ) : (
          <p className="text-body text-text-3">Replay unavailable</p>
        )}
        {scene ? (
          <input
            type="range"
            min={0}
            max={scene.totalMs}
            value={t}
            aria-label="Scrub the replay"
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            className="w-full accent-(--accent)"
          />
        ) : null}
        <Button
          variant="secondary"
          disabled={!scene}
          onClick={() => {
            fire("tick", { cue: "tap" });
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <SwitchRow label="Sound in video" on={sound} onChange={setSound} />
        {hidden ? (
          <p className="text-meta text-text-3">Show balances to share or save this video.</p>
        ) : making.kind === "making" ? (
          <p className="flex items-center gap-3 text-body">
            <span className="flex-1">Making video {Math.round(making.share * PERCENT)}%</span>
            <Button variant="secondary" size="sm" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          </p>
        ) : making.kind === "unavailable" ? (
          <p className="text-meta text-text-3">Video unavailable in this browser.</p>
        ) : making.kind === "failed" ? (
          <p className="text-meta text-text-3">The video couldn't be made. Try again.</p>
        ) : null}
        <Button
          disabled={!ready}
          onClick={() => {
            if (!ready) return;
            fire("tick", { cue: "tap" });
            downloadVideo(ready, name);
          }}
        >
          Save video
        </Button>
        <Button
          variant="secondary"
          disabled={!ready}
          onClick={() => {
            if (!ready) return;
            fire("tick", { cue: "tap" });
            void shareVideo(ready, name, "My Senryo replay").then((shared) => {
              if (shared) return;
              downloadVideo(ready, name);
              void navigator.clipboard?.writeText(url);
              notify({ title: "Saved — link copied", description: "This browser can't share files." });
            });
          }}
        >
          Share video
        </Button>
      </div>
    </Modal>
  );
}
