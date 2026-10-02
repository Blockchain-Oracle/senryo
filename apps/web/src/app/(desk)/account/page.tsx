import type { Metadata } from "next";
import { AccountScreen } from "@/components/screens/account-screen";
import { Column } from "@/components/shell/column";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Column>
      <AccountScreen />
    </Column>
  );
}
