import { ShellScreen } from "~/components/shell/ShellScreen";

export default function RecoveryScreen() {
  return (
    <ShellScreen
      title="Recovery"
      why="Recovery arrives with sign-in"
      detail="Check passkey sync, add a second passkey, or (under Advanced) export your recovery phrase."
    />
  );
}
