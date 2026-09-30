import { ShellScreen } from "~/components/shell/ShellScreen";

export default function DepositaddressScreen() {
  return (
    <ShellScreen
      title="Deposit address"
      why="Your deposit address appears after sign-in"
      detail="Each account gets its own persistent address with the accepted assets, minimum, fee and ETA listed above the QR."
    />
  );
}
