import { SheetRoute } from "~/components/sheet/SheetRoute";

export default function SessionSheet() {
  return (
    <SheetRoute
      title="Trading session"
      body="Inside an unlocked session, small trades need no prompt. It locks after 30 minutes, 5 idle minutes, or when the app goes to the background."
    />
  );
}
