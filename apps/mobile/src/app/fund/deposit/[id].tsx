import { ShellScreen } from "~/components/shell/ShellScreen";

export default function DepositScreen() {
  return (
    <ShellScreen
      title="Deposit"
      why="Deposit timelines arrive with funding"
      detail="Waiting → Received → Bridging → Credited, resumable if the app closes."
    />
  );
}
