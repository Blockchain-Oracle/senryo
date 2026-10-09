"use client";
/**
 * The one confetti layer over the app (the phone's `ConfettiHost` + `Confetti`): bursts on `celebrate()` in the Senryo
 * colours, on a canvas that exists only while a burst is in the air; nothing under reduced motion.
 */
import { useEffect, useRef, useState } from "react";
import { CONFETTI as C } from "@/lib/constants/confetti";
import { onCelebrate } from "@/lib/feedback/celebrate";

const COLOURS = ["--chart-up", "--primary", "--gold", "--practice", "--foreground"] as const;
const DOT = 0;
const STRIP = 2;
const HALF = 2;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  r: number;
  vr: number;
  drag: number;
  c: number;
  shape: number;
}

function launch(width: number, height: number): Piece[] {
  return C.emitters.flatMap((fx) =>
    Array.from({ length: C.perEmitter }, () => {
      const speed = C.speedMin + Math.random() * C.speedSpread;
      const angle =
        -Math.PI / HALF + (Math.random() - C.fadeFrom) * C.spread + (fx < C.fadeFrom ? -C.outward : C.outward);
      return {
        x: width * fx,
        y: height * C.originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: C.wMin + Math.random() * C.wSpread,
        h: C.hMin + Math.random() * C.hSpread,
        r: Math.random() * Math.PI,
        vr: (Math.random() - C.fadeFrom) * C.spin,
        drag: C.dragMin + Math.random() * C.dragSpread,
        c: Math.floor(Math.random() * COLOURS.length),
        shape: Math.floor(Math.random() * C.shapes),
      };
    }),
  );
}

export function ConfettiHost() {
  const [burst, setBurst] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => onCelebrate(() => setBurst((n) => n + 1)), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (burst === 0 || !canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, C.maxDpr);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const styles = getComputedStyle(document.documentElement);
    const colours = COLOURS.map((name) => styles.getPropertyValue(name).trim());
    const pieces = launch(w, h);
    let started = 0;
    let last = 0;
    let raf = 0;
    const frame = (now: number) => {
      if (started === 0) started = last = now;
      const t = (now - started) / C.lifeMs;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (t >= 1) return;
      const steps = Math.max(1, Math.round((now - last) / C.frameMs));
      last = now;
      ctx.globalAlpha = t < C.fadeFrom ? 1 : 1 - (t - C.fadeFrom) / C.fadeFrom;
      for (const p of pieces) {
        for (let i = 0; i < steps; i++) {
          p.vy += C.gravity;
          p.vx *= p.drag;
          p.vy *= p.drag;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
        }
        ctx.fillStyle = colours[p.c] ?? "currentColor";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        if (p.shape === DOT) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / HALF, 0, Math.PI * HALF);
          ctx.fill();
        } else {
          const ph = p.shape === STRIP ? p.w * C.stripRatio : p.h;
          const pw = p.shape === STRIP ? p.w / HALF : p.w;
          ctx.fillRect(-pw / HALF, -ph / HALF, pw, ph);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [burst]);

  return burst === 0 ? null : <canvas ref={canvasRef} aria-hidden className="confetti-layer" />;
}
