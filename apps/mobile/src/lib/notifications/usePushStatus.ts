/**
 * Whether a kind of news would reach this phone right now (S1b.15): the OS permission, a registration for this
 * account, and that kind's switch. Screens that promise a notification (an alert's footnote) say exactly this.
 */
import { useEffect, useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { type PushChannel, readPushPermission, savedRegistration } from "./push";

/** `on`: it will arrive. `off`: no permission on this phone. `muted`: allowed, but this kind is switched off. */
export type PushStatus = "on" | "off" | "muted";

export function usePushStatus(channel: PushChannel): PushStatus | undefined {
  const address = useAccount().hint?.address;
  const [status, setStatus] = useState<PushStatus>();
  useEffect(() => {
    let live = true;
    void readPushPermission().then((permission) => {
      if (!live) return;
      if (permission !== "granted") return setStatus("off");
      const saved = savedRegistration();
      const mine = saved && address && saved.address === address.toLowerCase();
      setStatus(mine && !saved.channels[channel] ? "muted" : "on");
    });
    return () => {
      live = false;
    };
  }, [address, channel]);
  return status;
}
