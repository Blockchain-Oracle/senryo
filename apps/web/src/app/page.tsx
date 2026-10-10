import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LandingMenu } from "@/components/public/landing-menu";
import { LiveHeroIsland } from "@/features/landing/LiveHeroIsland";
import { SignInIsland } from "@/features/landing/SignInIsland";
import { BRAND } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import pageStyles from "./welcome.module.css";
import chromeStyles from "./welcome-chrome.module.css";
import mobileStyles from "./welcome-mobile.module.css";
import productStyles from "./welcome-product.module.css";
import questionStyles from "./welcome-questions.module.css";

const styles = { ...pageStyles, ...chromeStyles, ...productStyles, ...questionStyles, ...mobileStyles };

const SCENE = { width: 756, height: 940 } as const;

/** How a call works, in the story's own art (the phone's onboarding scenes). */
const STEPS = [
  {
    key: "call",
    eyebrow: "01 / Call",
    title: ["Call the next move.", "Up or Down."],
    body: "Pick a market and a window — 1, 5 or 15 minutes, or an hour. The window opens on a Pyth price print: that's the line. Call whether the close lands above it or below.",
    art: "/brand/website/scene-call.webp",
    alt: "A gold line climbing past a dashed line on a lacquer tablet, with Up and Down dishes",
    caption: "The line is the window's opening print.",
  },
  {
    key: "payout",
    eyebrow: "02 / Paid",
    title: ["Payouts land", "on their own."],
    body: "When the window closes, its closing print settles every call in it, on Monad. Right, and the payout is in your balance — nothing to claim. Change your mind before the last 20 seconds and cash out at the live price.",
    art: "/brand/website/scene-payout.webp",
    alt: "Gold koban falling into a lacquer senryō-bako chest",
    caption: "Settled on chain. Nothing to claim.",
  },
  {
    key: "passkey",
    eyebrow: "03 / Yours",
    title: ["A passkey is", "your account."],
    body: "No seed phrase and no extension: a passkey makes your account and signs your calls. Turn on one-tap and small calls need no prompt at all, with caps the contracts enforce.",
    art: "/brand/website/scene-passkey.webp",
    alt: "A lacquer tablet with a passkey tag",
    caption: "Face ID or Touch ID. Your keys, your device.",
  },
] as const;

const QUESTIONS = [
  {
    question: "What is a call?",
    answer:
      "A call says where a price will be when a window closes: above its opening price (Up) or below it (Down). What a call pays is quoted before you make it, from the price and the time left; a right call pays that, a wrong one loses its stake.",
  },
  {
    question: "Where do the prices come from?",
    answer:
      "Pyth. Each window opens and closes on a Pyth price print that is posted on chain, and every receipt links to the transactions that posted them, so anyone can check how a call settled.",
  },
  {
    question: "Who pays the winners?",
    answer:
      "A pool on Monad takes the other side of every call within limits the contracts enforce: how much one window can carry and how much the pool can owe at once. When a window is full, it says so.",
  },
  {
    question: "Is this real money?",
    answer:
      "Practice uses free test dollars on Monad's test network: real prices, no value. Real uses USDC on Monad and opens with mainnet. A call can lose its whole stake — only call with what you can lose.",
  },
  {
    question: "How do I get the app?",
    answer:
      "Open the web app in any browser, or ask for the iPhone beta on TestFlight. Make an account with a passkey, take your test dollars, and make your first call in under a minute.",
  },
] as const;

const BETA_REQUEST = "mailto:support@senryo.xyz?subject=Senryo%20iPhone%20beta%20access";

/** The public product story: predictions on live prices. Sign-in stays in its client boundary; the art is Senryo's. */
export default function Welcome() {
  return (
    <div id="top" className={styles.site}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <a href="#top" className={styles.brand} aria-label="Senryo home">
          <Image src="/brand/seal.svg" width={40} height={40} alt="" />
          <span>
            {BRAND.name}
            <span className={styles.kanji}>{BRAND.kanji}</span>
          </span>
        </a>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#practice">Practice</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className={styles.headerActions}>
          <LandingMenu className={styles.mobileMenu} />
          <Link href={ROUTES.app} prefetch={false} className={styles.smallButton}>
            Open the app <ArrowUpRight size={17} aria-hidden />
          </Link>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Live on Monad · Prices by Pyth</p>
            <h1 id="hero-title">
              Call the
              <br />
              next move.
            </h1>
            <p className={styles.intro}>
              Up or Down on Bitcoin, Ethereum and Solana, a minute to an hour at a time. One tap to call, paid out on
              its own when the window closes.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} href="/app/trade/btc/" prefetch={false}>
                Make a call <ArrowRight size={19} aria-hidden />
              </Link>
              <a href="#how" className={styles.textLink}>
                How it works <ArrowRight size={18} aria-hidden />
              </a>
            </div>
            <p className={styles.betaNote}>Practice with free test dollars · no seed phrase</p>
          </div>
          <LiveHeroIsland />
        </section>

        <section id="how" className={styles.product} aria-labelledby="how-title">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 id="how-title">
              A window opens.
              <br />
              You call it.
            </h2>
          </div>
          {STEPS.map((step) => (
            <div key={step.key} className={styles.feature}>
              <div className={styles.walletArt}>
                <span className={styles.artCaption}>{step.caption}</span>
                <Image
                  src={step.art}
                  alt={step.alt}
                  width={SCENE.width}
                  height={SCENE.height}
                  className={styles.chest}
                />
                <span className={styles.artSignature}>{BRAND.kanji}</span>
              </div>
              <div className={styles.featureCopy}>
                <p className={styles.eyebrow}>{step.eyebrow}</p>
                <h3>
                  {step.title[0]}
                  <br />
                  {step.title[1]}
                </h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section id="practice" className={styles.practice} aria-labelledby="practice-title">
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>Practice → Real</p>
            <h2 id="practice-title">
              Start with
              <br />
              test dollars.
            </h2>
            <p>
              Practice runs on Monad's test network with free dollars and the same live prices — every call, cash-out
              and payout works as it will with money. Real uses USDC on Monad and opens with mainnet.
            </p>
            <Link href="/app/trade/btc/" prefetch={false} className={`${styles.whiteButton} ${styles.practiceAction}`}>
              Make a Practice call <ArrowRight size={19} aria-hidden />
            </Link>
            <p className={styles.smallNote}>Test dollars have no value. A call can lose its whole stake.</p>
          </div>
          <div className={styles.walletArt}>
            <span className={styles.artCaption}>Practice is free. Real starts when you switch.</span>
            <Image
              src="/brand/website/scene-modes.webp"
              alt="Practice notes in front and a gold koban set apart on its own dish: Practice · Test dollars and Real · USDC"
              width={SCENE.width}
              height={SCENE.height}
              className={styles.chest}
            />
            <span className={styles.artSignature}>{BRAND.kanji}</span>
          </div>
        </section>

        <section id="proof" className={styles.predictionSection} aria-labelledby="proof-title">
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>Proof</p>
            <h2 id="proof-title">
              Every call
              <br />
              has a receipt.
            </h2>
            <p>
              Each call shows its steps — placed, filled, cashed out or settled — each with its transaction on Monad,
              and the window it lived in: the opening and closing prints from Pyth, where the close landed against the
              line, and how the crowd called it.
            </p>
            <Link href={ROUTES.judges} prefetch={false} className={styles.textLink}>
              Contracts and how to check them <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>

        <section id="questions" className={styles.questions} aria-labelledby="questions-title">
          <div>
            <p className={styles.eyebrow}>A few things to know</p>
            <h2 id="questions-title">Good questions.</h2>
          </div>
          <div className={styles.faqList}>
            {QUESTIONS.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={22} aria-hidden />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="start" className={`${styles.entry} dark`} aria-labelledby="start-title">
          <div>
            <p className={styles.eyebrow}>Welcome to Senryo</p>
            <h2 id="start-title">
              Make your
              <br />
              first call.
            </h2>
            <p>
              A passkey makes your account. Test dollars arrive on their own.
              <br />
              The iPhone app is on TestFlight.
            </p>
          </div>
          <div className={styles.betaAccess}>
            <div className={styles.accountActions}>
              <SignInIsland />
            </div>
            <a href={BETA_REQUEST} className={styles.textLink}>
              Ask for the iPhone beta <ArrowUpRight size={18} aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <a href="#top" className={styles.brand} aria-label="Senryo home">
            <Image src="/brand/seal.svg" width={40} height={40} alt="" />
            <span>
              {BRAND.name}
              <span className={styles.kanji}>{BRAND.kanji}</span>
            </span>
          </a>
          <nav aria-label="Resources">
            <Link href={ROUTES.judges} prefetch={false}>
              Judge guide
            </Link>
            <Link href="/terms/" prefetch={false}>
              Terms
            </Link>
            <Link href="/privacy/" prefetch={false}>
              Privacy
            </Link>
          </nav>
        </div>
        <p className={styles.footerNote}>
          Senryo is in beta. Practice uses test dollars with no value; Real opens with mainnet. Calls on prices can lose
          their whole stake.
        </p>
        <span className={styles.footerWordmark} aria-hidden>
          Senryo
        </span>
      </footer>
    </div>
  );
}
