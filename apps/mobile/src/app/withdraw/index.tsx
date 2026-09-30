import { ShellScreen } from "~/components/shell/ShellScreen";

export default function WithdrawScreen() {
  return (
    <ShellScreen
      title="Withdraw"
      why="Withdrawals arrive with funding"
      detail="You'll withdraw up to your Withdrawable balance to your own address, another address, or another chain."
    />
  );
}
