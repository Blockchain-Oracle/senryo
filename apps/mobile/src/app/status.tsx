import { ShellScreen } from "~/components/shell/ShellScreen";

export default function StatusScreen() {
  return (
    <ShellScreen
      title="Status"
      why="Service status arrives with the API"
      detail="RPC, oracle ages, indexer lag, Perpl, intents and the card service, each with its last check."
    />
  );
}
