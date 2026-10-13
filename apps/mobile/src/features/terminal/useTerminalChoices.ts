/**
 * What the phone's terminal remembers (R5.4; MMKV, the web keeps them in localStorage): the stake and call type, Call
 * or Ride, the ride's margin, leverage (opt-in, D-344) and trail, and the call's trail. A market that doesn't ride shows Call whatever
 * was chosen; leverage is held to the market's cap when it's read (`leverageFor`).
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
  LEVERAGE_FIRST_ON_X,
  LEVERAGE_OFF_X,
  RIDE_TRAIL_BPS,
} from "@senryo/calls";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { DEFAULT_STAKE } from "./constants";

export function useTerminalChoices() {
  const [stake, setStake] = useMMKVNumber(STORAGE_KEYS.lastStake, storage);
  const [mode, setMode] = useMMKVString(STORAGE_KEYS.terminalMode, storage);
  const [instrument, setInstrument] = useMMKVString(STORAGE_KEYS.terminalInstrument, storage);
  const [margin, setMargin] = useMMKVNumber(STORAGE_KEYS.rideMargin, storage);
  const [leverage, setLeverage] = useMMKVNumber(STORAGE_KEYS.rideLeverage, storage);
  const [leverageOnX, setLeverageOnX] = useMMKVNumber(STORAGE_KEYS.rideLeverageOn, storage);
  const [rideTrail, setRideTrail] = useMMKVNumber(STORAGE_KEYS.rideTrail, storage);
  const [callTrail, setCallTrail] = useMMKVNumber(STORAGE_KEYS.callTrail, storage);
  const [chart, setChart] = useMMKVString(STORAGE_KEYS.terminalChart, storage);
  const [interval, storeInterval] = useMMKVString(STORAGE_KEYS.candleInterval, storage);
  return {
    stake: BigInt(stake ?? DEFAULT_STAKE),
    mode: isCallMode(mode) ? mode : ("updown" as CallMode),
    instrument: isInstrument(instrument) ? instrument : ("call" as Instrument),
    margin: margin === undefined ? DEFAULT_RIDE_MARGIN : BigInt(margin),
    /** Leverage in ×, as chosen (null: none chosen, so no leverage — D-344). */
    leverageX: leverage ?? null,
    /** The multiple leverage returns to when it's turned on again. */
    leverageOnX: leverageOnX ?? LEVERAGE_FIRST_ON_X,
    rideTrailBps: rideTrail ?? RIDE_TRAIL_BPS,
    callTrailCents: callTrail ?? DEFAULT_CALL_TRAIL_CENTS,
    candles: chart === "candles",
    candleInterval: (CANDLE_INTERVALS.find((i) => i === interval) ?? "1m") as CandleInterval,
    setStake: (s: bigint) => setStake(Number(s)),
    setMode: (m: CallMode) => setMode(m),
    setInstrument: (i: Instrument) => setInstrument(i),
    setMargin: (m: bigint) => setMargin(Number(m)),
    setLeverageX: (x: number) => {
      setLeverage(x);
      if (x > LEVERAGE_OFF_X) setLeverageOnX(x);
    },
    setRideTrailBps: (b: number) => setRideTrail(b),
    setCallTrailCents: (c: number) => setCallTrail(c),
    setCandles: (on: boolean) => setChart(on ? "candles" : "line"),
    setCandleInterval: (i: CandleInterval) => storeInterval(i),
  };
}

export type TerminalChoices = ReturnType<typeof useTerminalChoices>;
