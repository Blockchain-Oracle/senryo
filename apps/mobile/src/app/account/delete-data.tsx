import { ShellScreen } from "~/components/shell/ShellScreen";

export default function DeletemydataScreen() {
  return (
    <ShellScreen
      title="Delete my data"
      why="Nothing stored yet"
      detail="Deleting clears this device and your encrypted preferences. Onchain history is public and permanent."
    />
  );
}
