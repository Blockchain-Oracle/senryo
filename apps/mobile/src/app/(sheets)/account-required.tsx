import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function AccountRequiredSheet() {
  return (
    <SheetRoute
      title="Create an account to trade"
      body="Senryo accounts are a passkey — Face ID, no seed phrase. Sign-in arrives in the next build; you can keep browsing markets meanwhile."
    />
  );
}
