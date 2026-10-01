import { ShellScreen } from "~/components/shell/ShellScreen";

export default function AddtoWalletScreen() {
  return (
    <ShellScreen
      title="Add to Wallet"
      why="No card has been issued yet"
      detail="Kinpaku shown here is a sample. Once your card is issued, Apple Pay and Google Pay need the issuer's approval; until that is in place you add the card in the Wallet app with its revealed details."
    />
  );
}
