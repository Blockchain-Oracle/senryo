import { ShellScreen } from "~/components/shell/ShellScreen";

export default function SendScreen() {
  return (
    <ShellScreen
      title="Send"
      why="Sending arrives with funding"
      detail="Sending to another address always asks for Face ID and shows the amount and address first."
    />
  );
}
