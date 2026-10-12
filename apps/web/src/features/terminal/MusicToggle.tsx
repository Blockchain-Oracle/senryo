"use client";
/**
 * The terminal's music (D-317, F2; Tradash's footer toggle, Owarine `terminal/ui/ChartControls.tsx:105-132`): a ♪ button
 * — equaliser bars dance while it plays — and, when on, a chip naming the track ("Arcade ›") that steps to the next.
 * Off by default; the choice and the track persist with the other feedback settings. While mounted it owns the
 * terminal's music; leaving the terminal stops it.
 */
import { SONG_TITLES, TERMINAL_SONGS } from "@senryo/tokens";
import { Music } from "lucide-react";
import { useEffect } from "react";
import { fire, music, setFeedback, useFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const BARS = 3;

export function MusicToggle() {
  const s = useFeedback();
  const on = s.terminalMusic && s.sound;
  useEffect(() => {
    music(on ? s.track : null);
  }, [on, s.track]);
  useEffect(() => () => music(null), []);
  const next = () => {
    const i = TERMINAL_SONGS.indexOf(s.track);
    const track = TERMINAL_SONGS[(i + 1) % TERMINAL_SONGS.length] ?? "arcade";
    fire("tick", { cue: "toggle" });
    setFeedback({ track });
  };
  return (
    <div className="terminal-music">
      <button
        type="button"
        className={cn("terminal-music-toggle", on && "is-on")}
        aria-pressed={on}
        aria-label={on ? "Music on. Turn it off" : "Turn the music on"}
        onClick={() => {
          fire("tick", { cue: "toggle" });
          setFeedback({ terminalMusic: !s.terminalMusic, ...(s.sound ? {} : { sound: true }) });
        }}
      >
        {on ? (
          <span aria-hidden className="terminal-eq">
            {Array.from({ length: BARS }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: three fixed bars
              <i key={i} />
            ))}
          </span>
        ) : (
          <Music aria-hidden className="size-4" />
        )}
      </button>
      {on ? (
        <button type="button" className="terminal-music-track" onClick={next} aria-label="Next track">
          ♪ {SONG_TITLES[s.track]} ›
        </button>
      ) : null}
    </div>
  );
}
