import { ShellScreen } from "~/components/shell/ShellScreen";

export default function StatusScreen() {
  return (
    <ShellScreen
      title="Status"
      why="Service status arrives with the API"
      detail="The price source, Monad, the relayer, indexer lag and deposits, each with its last check."
    />
  );
}
