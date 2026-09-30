import { ShellScreen } from "~/components/shell/ShellScreen";

export default function SpendallowanceScreen() {
  return (
    <ShellScreen
      title="Spend allowance"
      why="Your daily card allowance is set here"
      detail="You sign a daily limit and expiry with Face ID; the card service can never hold more than you granted."
    />
  );
}
