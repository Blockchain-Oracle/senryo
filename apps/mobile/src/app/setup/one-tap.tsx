import { defaultOneTapTerms, useOneTap } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useCatalog } from "@senryo/query";
import { useState } from "react";
import { EntityMark } from "~/components/identity/EntityMark";
import { PRIMER_ART, PrimerScreen, type PrimerTone } from "~/features/setup/PrimerScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";

const DOLLAR_DECIMALS = 6;
const SECONDS_PER_MINUTE = 60;

/**
 * Setup — "Turn on one-tap calls" (pivot onboarding step 7, D-267/D-280): one Face ID grants this phone a capped
 * session key, so calls need no Face ID each time. The caps are stated up front and enforced on chain.
 */
export default function OneTapStep() {
  const { next, back } = useSetupNav("one-tap");
  const oneTap = useOneTap(useAccount());
  const catalog = useCatalog();
  const [status, setStatus] = useState<{ text: string; tone: PrimerTone }>();
  const terms = "value" in catalog ? defaultOneTapTerms(catalog.value.terms.session) : undefined;
  const caps = terms
    ? `$${formatUnits(terms.perCallCap, DOLLAR_DECIMALS, 0)} a call · $${formatUnits(terms.sessionCap, DOLLAR_DECIMALS, 0)} in all · ${terms.seconds / SECONDS_PER_MINUTE} min`
    : "Capped per call and per session";

  const turnOn = async () => {
    try {
      const result = await oneTap.turnOn();
      if (result !== "on") return;
      fire("confirm");
      setStatus({ text: "One-tap is on", tone: "up" });
      next();
    } catch (error) {
      fire("warn");
      notify({ title: "Couldn't turn on one-tap", description: (error as Error).message, tone: "warning" });
    }
  };

  return (
    <PrimerScreen
      step="one-tap"
      art={<EntityMark id={ids.brand("senryo")} size={PRIMER_ART} variant="symbol" decorative />}
      motion="lift"
      title="One-tap calls"
      body={caps}
      status={status}
      granted={oneTap.state.on}
      primary={{
        label: "Turn on",
        onPress: () => void turnOn(),
        loading: oneTap.busy,
        disabled: oneTap.busy || !terms,
      }}
      secondary={{ label: "Not now", onPress: next }}
      onBack={back}
      onSkip={next}
    />
  );
}
