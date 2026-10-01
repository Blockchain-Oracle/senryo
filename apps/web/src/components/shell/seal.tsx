import { ids } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";
import { SEAL_MARK_SIZE } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

/** The real seal (brand/senryo-seal.svg via @senryo/identity) for the top bar — never 千 set in a live font. */
export function SealMark({ className }: { className?: string }) {
  return (
    <EntityMark id={ids.brand("senryo")} size={SEAL_MARK_SIZE} variant="symbol" decorative className={cn(className)} />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SealMark />
      <span className="font-bold font-mono text-num-sm tracking-tight">SENRYO</span>
    </span>
  );
}
