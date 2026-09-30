import { ShellScreen } from "~/components/shell/ShellScreen";

export default function FromawalletScreen() {
  return (
    <ShellScreen
      title="From a wallet"
      why="Connect-from-wallet deposits arrive with funding"
      detail="You'll pick an asset and amount, approve the intent with Face ID, and follow a timeline until it's credited."
    />
  );
}
