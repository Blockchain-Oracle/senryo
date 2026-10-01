import { useCreatePost } from "@senryo/query";
import { router } from "expo-router";
import { Button } from "~/components/kit/Button";
import { Sheet } from "~/components/sheet/Sheet";
import { SheetHeading } from "~/components/sheet/SheetRoute";
import { ComposeThesis } from "~/features/social/ComposeThesis";
import { useSocialAccount } from "~/features/social/useSocialAccount";
import { ROUTES } from "~/lib/constants/routes";

/**
 * Compose a thesis (J8, S1b.14): a compact sheet over Social, opened from the tab's round utility. It stays attached
 * while the post is in flight, and dismissing it restores the feed where it was.
 */
export default function ComposeThesisSheet() {
  const { guest, session } = useSocialAccount();
  const create = useCreatePost(session);
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close new thesis" dismissible={!create.isPending}>
      {guest || !session ? (
        <>
          <SheetHeading
            title="New thesis"
            body="Posting needs an account. Create one with a passkey, then come back."
          />
          <Button label="Create account" onPress={() => router.replace(ROUTES.accountRequired)} />
        </>
      ) : (
        <ComposeThesis create={create} />
      )}
    </Sheet>
  );
}
