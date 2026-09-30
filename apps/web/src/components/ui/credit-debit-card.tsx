"use client";

// 21st: ravikatiyar162/credit-debit-card (#5276) — https://21st.dev/@ravikatiyar162/components/credit-debit-card
// Re-skinned as the Kinpaku 金箔 card: lacquer black with gold-leaf foil (all from --kinpaku-* tokens; the card keeps its
// own colours in both themes, like a physical card). Flip moved from hover to tap/Enter/Space (a toggle button);
// the base64 chip and the network logo are replaced by a foil chip and the Kinpaku mark.
import { forwardRef, type HTMLAttributes, type KeyboardEvent, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface FlippableCreditCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  cardholderName: string;
  /** Display PAN — masked unless step-up revealed it. */
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  /** Seal mark slot (brand 千 seal); defaults to a foil 千 square. */
  mark?: ReactNode;
  brandLabel?: string;
  kindLabel?: string;
}

const PAN_LAST_DIGITS = 4;
const FOIL_TEXT =
  "bg-[linear-gradient(115deg,var(--kinpaku-foil-deep),var(--kinpaku-foil-shade)_22%,var(--kinpaku-foil-light)_45%,var(--kinpaku-foil-highlight)_52%,var(--kinpaku-foil-mid)_62%,var(--kinpaku-foil-shade)_85%)] bg-clip-text text-transparent";
const FOIL_FILL =
  "bg-[linear-gradient(115deg,var(--kinpaku-foil-shade),var(--kinpaku-foil-light)_40%,var(--kinpaku-foil-highlight)_50%,var(--kinpaku-foil-mid)_65%,var(--kinpaku-foil-deep))]";
const LACQUER =
  "bg-[radial-gradient(120%_90%_at_85%_0%,var(--kinpaku-lacquer-edge),var(--kinpaku-lacquer)_60%)] text-[var(--kinpaku-foil-highlight)]";
const FACE = "absolute inset-0 overflow-hidden rounded-xl border border-kinpaku-foil-shade/35 backface-hidden";

function FoilSeal() {
  return (
    <span
      aria-hidden
      className="grid size-9 place-items-center rounded-xs border-2 border-kinpaku-foil-shade/80 font-bold text-title leading-none"
    >
      <span className={FOIL_TEXT}>千</span>
    </span>
  );
}

function FoilChip() {
  return (
    <span aria-hidden className={cn("relative block h-7 w-9 overflow-hidden rounded-sm", FOIL_FILL)}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-kinpaku-foil-shade/70" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-kinpaku-foil-shade/70" />
      <span className="absolute inset-2 rounded-xs border border-kinpaku-foil-shade/70" />
    </span>
  );
}

const FlippableCreditCard = forwardRef<HTMLDivElement, FlippableCreditCardProps>(
  (
    {
      className,
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      mark,
      brandLabel = "KINPAKU 金箔",
      kindLabel = "VIRTUAL · DEBIT",
      ...props
    },
    ref,
  ) => {
    const [flipped, setFlipped] = useState(false);
    const toggle = () => setFlipped((f) => !f);
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      toggle();
    };

    return (
      // biome-ignore lint/a11y/useSemanticElements: the 3D flip needs block faces, which <button> content may not contain
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${brandLabel} card ending ${cardNumber.slice(-PAN_LAST_DIGITS)}. ${flipped ? "Showing back" : "Showing front"}; press to flip.`}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={cn(
          "group aspect-[86/54] w-full max-w-sm cursor-pointer select-none rounded-xl outline-none perspective-distant focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "relative size-full rounded-xl transition-transform duration-500 ease-desk transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div className={cn(FACE, LACQUER)}>
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-y-1/2 -right-1/4 w-1/2 rotate-12 bg-[linear-gradient(90deg,transparent,var(--kinpaku-foil-light),transparent)] opacity-10"
            />
            <div className="relative flex h-full flex-col justify-between p-4">
              <div className="flex items-start justify-between">
                {mark ?? <FoilSeal />}
                <p className={cn("font-mono font-bold text-label tracking-label", FOIL_TEXT)}>{brandLabel}</p>
              </div>
              <FoilChip />
              <p className="font-mono text-num-md tracking-wider tnum">{cardNumber}</p>
              <div className="flex items-end justify-between">
                <div className="text-left">
                  <p className="font-mono text-micro uppercase tracking-label opacity-60">Card holder</p>
                  <p className="font-mono text-caption font-medium">{cardholderName}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-micro uppercase tracking-label opacity-60">Expires</p>
                  <p className="font-mono text-caption font-medium tnum">{expiryDate}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={cn(FACE, LACQUER, "rotate-y-180")}>
            <div className="flex h-full flex-col">
              <div className="mt-5 h-9 w-full bg-kinpaku-edge" />
              <div className="mx-4 mt-4 flex h-8 items-center justify-end rounded-sm bg-[var(--kinpaku-foil-highlight)] pr-3">
                <p className="font-mono text-caption text-[var(--kinpaku-lacquer)] tnum">{cvv}</p>
              </div>
              <p className="self-end pt-1 pr-4 font-mono text-micro uppercase tracking-label opacity-60">CVV</p>
              <div className="mt-auto flex items-end justify-between p-4">
                <p className="font-mono text-micro uppercase tracking-label opacity-60">{kindLabel}</p>
                <p className={cn("font-bold text-title leading-none", FOIL_TEXT)}>千両</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
FlippableCreditCard.displayName = "FlippableCreditCard";

export { FlippableCreditCard };
