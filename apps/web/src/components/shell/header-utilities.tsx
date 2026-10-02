"use client";

// 21st: ruixen.ui/notification-button (#7914, as on the phone) — a round control with the bell and, at its upper
// right, a pill with the count: hidden at zero, never a bare dot, capped at "99+".
import { Bell, History } from "lucide-react";
import Link from "next/link";
import { useAccount } from "@/lib/account/provider";
import { ROUTES } from "@/lib/constants/routes";
import { useBellCount } from "@/lib/notifications/inbox";

const COUNT_CAP = 99;
const CIRCLE =
  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-raised-2 text-foreground transition-colors hover:bg-row-pressed focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4";

/** Activity (clock) and Notifications (bell with its unread count), as in the phone's Home header. */
export function HeaderUtilities() {
  const signedIn = useAccount().hint !== undefined;
  const count = useBellCount();
  if (!signedIn) return null;
  const text = count === undefined ? undefined : count > COUNT_CAP ? `${COUNT_CAP}+` : String(count);
  return (
    <>
      <Link href={ROUTES.activity} aria-label="Activity" title="Activity" className={CIRCLE}>
        <History />
      </Link>
      <Link
        href={ROUTES.notifications}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        title="Notifications"
        className={CIRCLE}
      >
        <Bell />
        {text ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-micro text-primary-foreground"
          >
            {text}
          </span>
        ) : null}
      </Link>
    </>
  );
}
