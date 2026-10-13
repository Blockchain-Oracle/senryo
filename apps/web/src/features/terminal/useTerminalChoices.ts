"use client";
/**
 * What the terminal remembers on this device (R5.4): the lane, Call or Ride, the call's kind, stake and trail, and the
 * ride's margin, leverage and trail, and the chart's view (line or candles, and the candles' interval, R5.17). A market that doesn't ride shows Call whatever was chosen; leverage is held to the
 * market's cap when it's read (`leverageFor`).
 */
import {
  CANDLE_INTERVALS,
  type CallMode,
  type CandleInterval,
  DEFAULT_CALL_TRAIL_CENTS,
  DEFAULT_RIDE_MARGIN,
  type Instrument,
  isCallMode,
  isInstrument,
  RIDE_TRAIL_BPS,
} from "@senryo/calls";
import { DEFAULT_CADENCE } from "@senryo/calls/react";
import { CADENCES_SEC, type CadenceSec } from "@senryo/config";
import { TERMINAL_STORAGE, useStoredString } from "@/lib/terminal/stored";
import { DEFAULT_STAKE } from "./constants";

const WHOLE_NUMBER = /^\d+$/;

const amount = (stored: string | null, fallback: bigint): bigint =>
  stored && WHOLE_NUMBER.test(stored) ? BigInt(stored) : fallback;
const count = (stored: string | null, fallback: number): number =>
  stored && WHOLE_NUMBER.test(stored) ? Number(stored) : fallback;

export function useTerminalChoices() {
  const [cadence, setCadence] = useStoredString(TERMINAL_STORAGE.cadence);
  const [stake, setStake] = useStoredString(TERMINAL_STORAGE.stake);
  const [mode, setMode] = useStoredString(TERMINAL_STORAGE.mode);
  const [instrument, setInstrument] = useStoredString(TERMINAL_STORAGE.instrument);
  const [margin, setMargin] = useStoredString(TERMINAL_STORAGE.rideMargin);
  const [leverage, setLeverage] = useStoredString(TERMINAL_STORAGE.leverage);
  const [rideTrail, setRideTrail] = useStoredString(TERMINAL_STORAGE.rideTrail);
  const [callTrail, setCallTrail] = useStoredString(TERMINAL_STORAGE.callTrail);
  const [chart, setChart] = useStoredString(TERMINAL_STORAGE.chart);
  const [interval, storeInterval] = useStoredString(TERMINAL_STORAGE.candleInterval);
  return {
    cadence: CADENCES_SEC.find((c) => String(c) === cadence) ?? DEFAULT_CADENCE,
    stake: amount(stake, DEFAULT_STAKE),
    mode: isCallMode(mode) ? mode : ("updown" as CallMode),
    instrument: isInstrument(instrument) ? instrument : ("call" as Instrument),
    margin: amount(margin, DEFAULT_RIDE_MARGIN),
    /** Leverage in ×, as chosen (null: the market's default). */
    leverageX: leverage && WHOLE_NUMBER.test(leverage) ? Number(leverage) : null,
    rideTrailBps: count(rideTrail, RIDE_TRAIL_BPS),
    callTrailCents: count(callTrail, DEFAULT_CALL_TRAIL_CENTS),
    candles: chart === "candles",
    candleInterval: (CANDLE_INTERVALS.find((i) => i === interval) ?? "1m") as CandleInterval,
    setCadence: (c: CadenceSec) => setCadence(String(c)),
    setStake: (s: bigint) => setStake(String(s)),
    setMode: (m: CallMode) => setMode(m),
    setInstrument: (i: Instrument) => setInstrument(i),
    setMargin: (m: bigint) => setMargin(String(m)),
    setLeverageX: (x: number) => setLeverage(String(x)),
    setRideTrailBps: (b: number) => setRideTrail(String(b)),
    setCallTrailCents: (c: number) => setCallTrail(String(c)),
    setCandles: (on: boolean) => setChart(on ? "candles" : "line"),
    setCandleInterval: (i: CandleInterval) => storeInterval(i),
  };
}

export type TerminalChoices = ReturnType<typeof useTerminalChoices>;
