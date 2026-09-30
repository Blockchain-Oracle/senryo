import { ShellScreen } from "~/components/shell/ShellScreen";

export default function AddtoWalletScreen() {
  return (
    <ShellScreen
      title="Add to Wallet"
      why="Wallet provisioning isn't enabled"
      detail="Apple and Google Wallet need issuer approval. Until then, add the card manually in the Wallet app with the revealed details."
    />
  );
}
