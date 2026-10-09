"use client";
/**
 * The landing's sign-in (create, sign in, continue, recover) as an island with its own account runtime: the landing
 * is the front door, so its first load carries none of it. A quiet block holds the place while it loads.
 */
import dynamic from "next/dynamic";

const SignIn = dynamic(
  () =>
    Promise.all([
      import("@/components/auth/welcome-actions"),
      import("@/components/auth/step-up"),
      import("@/lib/account/provider"),
    ]).then(([{ WelcomeActions }, { StepUpProvider }, { AccountProvider }]) => {
      function Island() {
        return (
          <AccountProvider>
            <StepUpProvider>
              <WelcomeActions />
            </StepUpProvider>
          </AccountProvider>
        );
      }
      return Island;
    }),
  { ssr: false, loading: () => <div className="min-h-56" aria-hidden /> },
);

export function SignInIsland() {
  return <SignIn />;
}
