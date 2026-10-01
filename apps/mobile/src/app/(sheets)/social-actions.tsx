import type { Address } from "@senryo/account";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SocialActions } from "~/features/social/SocialActions";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * The overflow of a post (`?post&author&thesis`) or a profile (`?author`) — J8, S1b.14: report, mute, block, and
 * delete on your own post. It stays attached while a write is in flight. When the action removed what was under the
 * sheet (the thread's own thesis was deleted, reported or its author blocked), dismissing it leaves that page too.
 */
export default function SocialActionsSheet() {
  const params = useLocalSearchParams<{ post?: string; author?: string; thesis?: string }>();
  const [busy, setBusy] = useState(false);
  const leave = useRef(false);
  const author = params.author && ADDRESS.test(params.author) ? (params.author as Address) : undefined;
  return (
    <Sheet
      onClose={() => {
        router.back();
        if (leave.current) router.back();
      }}
      closeLabel="Close actions"
      dismissible={!busy}
    >
      {author ? (
        <SocialActions
          target={{ author, post: params.post || undefined, thesis: params.thesis === "1" }}
          onBusy={setBusy}
          onLeave={() => {
            leave.current = true;
          }}
        />
      ) : (
        <SheetHeading title="Nothing to act on" body="This link doesn’t name a post or a profile." />
      )}
    </Sheet>
  );
}
