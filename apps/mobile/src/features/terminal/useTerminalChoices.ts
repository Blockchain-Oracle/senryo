/**
 * What the phone's terminal remembers (R5.4; MMKV, the web keeps them in localStorage): the stake and call type, Call
 * or Ride, the ride's margin, leverage and trail, and the call's trail. A market that doesn't ride shows Call whatever
 * was chosen; leverage is held to the market's cap when it's read (`leverageFor`).
 */
import {
  type CallMode,
  DEFAULT_CALL_TRAIL_CENTS,
  DEFAULT_RIDE_MARGIN,
  type Instrument,
  isCallMode,
  isInstrument,
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
  const [rideTrail, setRideTrail] = useMMKVNumber(STORAGE_KEYS.rideTrail, storage);
  const [callTrail, setCallTrail] = useMMKVNumber(STORAGE_KEYS.callTrail, storage);
  return {
    stake: BigInt(stake ?? DEFAULT_STAKE),
    mode: isCallMode(mode) ? mode : ("updown" as CallMode),
    instrument: isInstrument(instrument) ? instrument : ("call" as Instrument),
    margin: margin === undefined ? DEFAULT_RIDE_MARGIN : BigInt(margin),
    leverageX: leverage ?? null,
    rideTrailBps: rideTrail ?? RIDE_TRAIL_BPS,
    callTrailCents: callTrail ?? DEFAULT_CALL_TRAIL_CENTS,
    setStake: (s: bigint) => setStake(Number(s)),
    setMode: (m: CallMode) => setMode(m),
    setInstrument: (i: Instrument) => setInstrument(i),
    setMargin: (m: bigint) => setMargin(Number(m)),
    setLeverageX: (x: number) => setLeverage(x),
    setRideTrailBps: (b: number) => setRideTrail(b),
    setCallTrailCents: (c: number) => setCallTrail(c),
  };
}

export type TerminalChoices = ReturnType<typeof useTerminalChoices>;
