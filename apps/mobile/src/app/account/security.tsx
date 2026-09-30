import { ShellScreen } from "~/components/shell/ShellScreen";

export default function SecurityScreen() {
  return (
    <ShellScreen
      title="Security"
      why="Security settings arrive with sign-in"
      detail="Session length, idle lock, per-trade Face ID and lock-now live here. Loosening any of them asks for Face ID."
    />
  );
}
