"use client";
/**
 * The top line's bell (R5.22; the phone's `NotificationsBell`): it opens the inbox drawer and carries the unread
 * count as a number — never a dot — once the inbox can be read without a prompt (an unlocked account or the guest).
 */
import { Bell } from "lucide-react";
import { useBellCount } from "@/features/notifications/useInbox";
import { tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";

/** Past this the count reads "99+". */
const COUNT_MAX = 99;

export function BellButton() {
  const count = useBellCount();
  const shown = count === undefined ? null : count > COUNT_MAX ? `${COUNT_MAX}+` : String(count);
  return (
    <button
      type="button"
      className="topline-icon topline-bell"
      aria-label={shown ? `Notifications, ${shown} unread` : "Notifications"}
      onClick={() => {
        tapFeedback();
        openDrawer(DRAWERS.inbox);
      }}
    >
      <Bell aria-hidden />
      {shown ? (
        <span aria-hidden className="topline-count tnum">
          {shown}
        </span>
      ) : null}
    </button>
  );
}
