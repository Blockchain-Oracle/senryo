import { TabStack } from "~/components/shell/TabStack";

export default function Layout() {
  return <TabStack />;
}

/** Deep links into a pushed page keep the tab root underneath, so back always has somewhere to go. */
export const unstable_settings = { initialRouteName: "index" };
