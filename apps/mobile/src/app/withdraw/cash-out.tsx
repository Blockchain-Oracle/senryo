import { ShellScreen } from "~/components/shell/ShellScreen";

export default function CashoutScreen() {
  return (
    <ShellScreen
      title="Cash out"
      why="Cash-out to another chain arrives with funding"
      detail="Quotes and ETA come from the intents route before you confirm."
    />
  );
}
