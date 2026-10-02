import { ShellScreen } from "~/components/shell/ShellScreen";

export default function AddtoWalletScreen() {
  return (
    <ShellScreen
      title="Add to Wallet"
      why="No card has been issued yet"
      detail="Apple Pay and Google Pay provisioning require issuer support. This integration is not available yet."
    />
  );
}
