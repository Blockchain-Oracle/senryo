import { ShellScreen } from "~/components/shell/ShellScreen";

export default function AuthorizationScreen() {
  return (
    <ShellScreen
      title="Authorization"
      why="Card authorizations arrive with the card service"
      detail="Each hold, capture and release will show its amount, merchant and what it did to Free to spend."
    />
  );
}
