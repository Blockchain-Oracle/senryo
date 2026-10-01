/**
 * Follow / Following (Fomo F13/F30): the filled primary invites, the quiet plate says it is done; a tap toggles and the
 * button holds its width while the write is in flight. Following is not copy trading and moves no money. A guest's tap
 * opens the account invitation; a block in either direction is said on the button, not discovered on tap.
 *
 * What it shows before a tap: the caller's `hint` when the list already knows (a row in your own Following), else the
 * session's answer once a session exists, else your public Following list. It never raises a prompt by being on screen.
 */
import type { Address } from "@senryo/account";
import { useFollowList, useFollowState, useFollowToggle } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { Button } from "~/components/kit/Button";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { notify } from "~/lib/notify";
import { sameAddress, socialErrorCopy } from "./format";
import { useSessionGate } from "./useSocialAccount";

/** Wide enough for "Following" and its spinner, so the row never shifts between states. */
const MIN_WIDTH = 112;

export function FollowButton({ other, name, hint }: { other: Address; name: string; hint?: boolean | undefined }) {
  const gate = useSessionGate();
  const { address: me, session } = gate;
  const asked = hint === undefined && gate.status === "ready";
  const state = useFollowState(me, asked ? other : undefined, session);
  // Without a session the public list still says whether you follow them (your first page of follows).
  const mine = useFollowList(hint === undefined && !asked ? me : undefined, "following");
  const write = useFollowToggle(me, session);
  const [answer, setAnswer] = useState<boolean>();
  if (sameAddress(me, other)) return null;

  const known = state.status === "fresh" || state.status === "stale" ? state.value : undefined;
  const listed =
    mine.reading.status === "fresh" || mine.reading.status === "stale"
      ? mine.reading.value.some((entry) => sameAddress(entry.address, other))
      : undefined;
  const following = answer ?? known?.following ?? hint ?? listed ?? false;
  if (known?.blocked)
    return <Button label="Blocked" variant="secondary" size="sm" block={false} disabled style={styles.button} />;

  const toggle = () => {
    if (gate.status === "guest" || !session) {
      router.push(ROUTES.accountRequired);
      return;
    }
    write.mutate(
      { other, follow: !following },
      {
        onSuccess: (next) => {
          fire("confirm");
          setAnswer(next.following);
        },
        onError: (error) => {
          fire("fail");
          notify({
            title: following ? `Couldn’t unfollow ${name}` : `Couldn’t follow ${name}`,
            description: socialErrorCopy(error, "Check your connection and try again."),
            tone: "warning",
          });
        },
      },
    );
  };
  return (
    <Button
      label={following ? "Following" : "Follow"}
      variant={following ? "secondary" : "primary"}
      size="sm"
      block={false}
      loading={write.isPending}
      onPress={toggle}
      accessibilityHint={following ? `Stops following ${name}` : `Follows ${name}. Following never copies a trade`}
      style={styles.button}
    />
  );
}

/** `alignSelf` centres it in a row (a compact Button otherwise pins itself to the start of the cross axis). */
const styles = StyleSheet.create({ button: { minWidth: MIN_WIDTH, alignSelf: "center" } });
