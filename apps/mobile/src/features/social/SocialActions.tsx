/**
 * The overflow of a post or a profile (S12b.6, App Store 1.2): Report, Mute, Block — and Delete on your own post. One
 * compact sheet that walks menu → confirmation → result, so every action is confirmed before it happens and says what
 * it did after. Mute and block are private to you; a block also removes follows both ways (the api's rule).
 */
import type { Address } from "@senryo/account";
import { type ReportReason, SUPPORT_EMAIL } from "@senryo/api-client";
import { useDeletePost, useProfile, useRelations, useRelationToggle, useReport } from "@senryo/query";
import { Ban, Flag, Trash2, VolumeX } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, type ButtonVariant } from "~/components/kit/Button";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { SheetRow } from "~/components/sheet/SheetRow";
import { fire } from "~/feedback/fire";
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { handleOf, sameAddress, socialErrorCopy } from "./format";
import { ReportStep } from "./ReportStep";
import { useSessionGate } from "./useSocialAccount";

export interface ActionTarget {
  author: Address;
  /** The post acted on; without one the target is the profile. */
  post: string | undefined;
  /** The post is the thread's own thesis (deleting or reporting it ends the thread for you). */
  thesis: boolean;
}

type Act = "mute" | "unmute" | "block" | "unblock" | "delete";
type Step =
  | { at: "menu" }
  | { at: "report"; reason: ReportReason | undefined }
  | { at: "confirm"; act: Act }
  | { at: "done"; title: string; body: string };

interface ConfirmCopy {
  title: string;
  body: string;
  action: string;
  variant: ButtonVariant;
  done: { title: string; body: string };
}

export function SocialActions({
  target,
  onBusy,
  onLeave,
}: {
  target: ActionTarget;
  /** The sheet stays attached while a write is in flight. */
  onBusy: (busy: boolean) => void;
  /** What was shown under the sheet no longer exists for this person: the page under it should go too. */
  onLeave: () => void;
}) {
  const { color } = useTheme();
  const close = useSheetClose();
  const gate = useSessionGate();
  const { session, address: me } = gate;
  // Only once a session exists: a menu never raises Face ID by opening.
  const known = gate.status === "ready" ? session : undefined;
  const profile = useProfile(target.author);
  const mutes = useRelations("mutes", known);
  const blocks = useRelations("blocks", known);
  const report = useReport(session);
  const mute = useRelationToggle("mutes", session);
  const block = useRelationToggle("blocks", session);
  const remove = useDeletePost(session);
  const [step, setStep] = useState<Step>({ at: "menu" });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  // The handle when the profile is public here; the short address otherwise.
  const who = handleOf(
    profile.status === "fresh" || profile.status === "stale"
      ? profile.value
      : { address: target.author, handle: null, displayName: null },
  );
  const mine = sameAddress(target.author, me);
  const what = target.post ? (target.thesis ? "post" : "reply") : "profile";
  const has = (reading: typeof mutes) =>
    (reading.status === "fresh" || reading.status === "stale") &&
    reading.value.some((entry) => sameAddress(entry.address, target.author));
  const muted = has(mutes);
  const blocked = has(blocks);

  const run = async (work: () => Promise<unknown>, done: { title: string; body: string }, leave: boolean) => {
    setFailure(undefined);
    setBusy(true);
    onBusy(true);
    try {
      await work();
      fire("confirm");
      if (leave) onLeave();
      setStep({ at: "done", ...done });
    } catch (error) {
      fire("fail");
      setFailure(socialErrorCopy(error, "That didn’t go through. Check your connection and try again."));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };

  const confirmCopy = (act: Act): ConfirmCopy => {
    switch (act) {
      case "mute":
        return {
          title: `Mute ${who}?`,
          body: "Their posts and trades leave your feed. They aren’t told, and you can still open their profile.",
          action: "Mute",
          variant: "primary",
          done: { title: `${who} is muted`, body: "Unmute from the same menu on their profile or posts." },
        };
      case "unmute":
        return {
          title: `Unmute ${who}?`,
          body: "Their posts and trades return to your feed.",
          action: "Unmute",
          variant: "primary",
          done: { title: `${who} is unmuted`, body: "Their activity shows in your feed again." },
        };
      case "block":
        return {
          title: `Block ${who}?`,
          body: "Neither of you can follow, reply to or like the other, and each of you leaves the other’s feed. Follows between you are removed.",
          action: "Block",
          variant: "destructive",
          done: { title: `${who} is blocked`, body: "Unblock from the same menu on their profile." },
        };
      case "unblock":
        return {
          title: `Unblock ${who}?`,
          body: "You can follow and reply to each other again. Follows that were removed don’t come back by themselves.",
          action: "Unblock",
          variant: "primary",
          done: { title: `${who} is unblocked`, body: "You can follow them again from their profile." },
        };
      case "delete":
        return {
          title: `Delete this ${what}?`,
          body: target.thesis ? "Its replies and likes go with it. This can’t be undone." : "This can’t be undone.",
          action: "Delete",
          variant: "destructive",
          done: { title: "Deleted", body: `Your ${what} is gone from this network.` },
        };
    }
  };

  const perform = (act: Act) => {
    const copy = confirmCopy(act);
    const { post } = target;
    if (act === "delete") {
      if (post) void run(() => remove.mutateAsync(post), copy.done, target.thesis);
      return;
    }
    const toggle = act === "mute" || act === "unmute" ? mute : block;
    const on = act === "mute" || act === "block";
    void run(() => toggle.mutateAsync({ address: target.author, on }), copy.done, act === "block" && target.thesis);
  };

  if (step.at === "report") {
    const { reason } = step;
    const { post } = target;
    return (
      <ReportStep
        what={what}
        reason={reason}
        onPick={(next) => setStep({ at: "report", reason: next })}
        onBack={() => {
          setFailure(undefined);
          setStep({ at: "menu" });
        }}
        busy={busy}
        failure={failure}
        onSend={() => {
          if (!reason) return;
          void run(
            () => report.mutateAsync(post ? { post, reason } : { profile: target.author, reason }),
            {
              title: "Report sent",
              body: `Thank you. We review every report and act on what breaks the rules${post ? "; this is now hidden for you" : ""}. Urgent? Write to ${SUPPORT_EMAIL}.`,
            },
            post !== undefined && target.thesis,
          );
        }}
      />
    );
  }

  if (step.at === "confirm") {
    const copy = confirmCopy(step.act);
    return (
      <>
        <SheetHeading title={copy.title} body={copy.body} />
        {failure ? (
          <Text accessibilityRole="alert" style={[TYPE.rowDetail, styles.center, { color: color.down }]}>
            {failure}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label={copy.action} variant={copy.variant} loading={busy} onPress={() => perform(step.act)} />
          <Button
            label="Cancel"
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={() => {
              setFailure(undefined);
              setStep({ at: "menu" });
            }}
          />
        </View>
      </>
    );
  }

  if (step.at === "done") {
    return (
      <>
        <SheetHeading title={step.title} body={step.body} />
        <Button label="Done" variant="secondary" onPress={() => close()} />
      </>
    );
  }

  const icon = { size: SIZE.icon, strokeWidth: SIZE.iconStroke } as const;
  return (
    <>
      <SheetHeading title={target.post ? `This ${what}` : who} />
      <View style={styles.rows}>
        {mine ? (
          target.post ? (
            <SheetRow
              title={`Delete ${what}`}
              detail={target.thesis ? "Its replies and likes go with it" : "Remove your reply from the thread"}
              leading={<Trash2 {...icon} color={color.destructive} />}
              onPress={() => setStep({ at: "confirm", act: "delete" })}
            />
          ) : null
        ) : (
          <>
            <SheetRow
              index={0}
              title={`Report ${what}`}
              detail="Spam, scams, harassment and more"
              leading={<Flag {...icon} color={color.ink} />}
              onPress={() => setStep({ at: "report", reason: undefined })}
            />
            <SheetRow
              index={1}
              title={muted ? `Unmute ${who}` : `Mute ${who}`}
              detail={muted ? "Show their activity in your feed again" : "Hide their posts and trades from your feed"}
              leading={<VolumeX {...icon} color={color.ink} />}
              onPress={() => setStep({ at: "confirm", act: muted ? "unmute" : "mute" })}
            />
            <SheetRow
              index={2}
              title={blocked ? `Unblock ${who}` : `Block ${who}`}
              detail={blocked ? "Let you follow and reply to each other again" : "Stop all contact, both ways"}
              leading={<Ban {...icon} color={color.destructive} />}
              onPress={() => setStep({ at: "confirm", act: blocked ? "unblock" : "block" })}
            />
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rows: { gap: SHEET_SHAPE.rowGap },
  actions: { gap: SPACE.sm },
  center: { textAlign: "center" },
});
