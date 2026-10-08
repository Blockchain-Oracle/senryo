import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { WelcomeActions } from "@/components/auth/welcome-actions";
import { LandingMenu } from "@/components/public/landing-menu";
import { BRAND } from "@/lib/constants/brand";
import { ROUTES } from "@/lib/constants/routes";
import pageStyles from "./welcome.module.css";
import artStyles from "./welcome-art.module.css";
import chromeStyles from "./welcome-chrome.module.css";
import mobileStyles from "./welcome-mobile.module.css";
import productStyles from "./welcome-product.module.css";
import questionStyles from "./welcome-questions.module.css";

const styles = { ...pageStyles, ...chromeStyles, ...productStyles, ...artStyles, ...questionStyles, ...mobileStyles };

const QUESTIONS = [
  {
    question: "What can I do in Practice?",
    answer:
      "Try supported gold, silver and FX markets with paper funds. Open a position, follow its movement and close it when you’re ready. Practice funds have no cash value. Market hours and availability still apply.",
  },
  {
    question: "Can I use real money yet?",
    answer:
      "You can browse Mainnet tokens and markets in Senryo. Mainnet trading is not enabled in this beta. Start in Practice to explore the trading experience with paper funds.",
  },
  {
    question: "Is Kinpaku a live payment card?",
    answer:
      "Kinpaku is currently a sandbox card in the mobile beta. You can set a daily limit, freeze it and review test receipts. It cannot pay for goods or be added to Apple Wallet yet.",
  },
  {
    question: "How do I get the mobile app?",
    answer:
      "Request an iOS TestFlight invitation below. In the app, look around before creating an account, then use a passkey to start in Practice. The browser preview remains available for exploring Senryo on a computer.",
  },
] as const;

const BETA_REQUEST = "mailto:support@senryo.xyz?subject=Senryo%20iOS%20beta%20access";

const PORTRAITS = ["avatar-01-topknot", "avatar-03-kanzashi", "avatar-05-curls", "avatar-11-kasa"] as const;

/** Public product story. Authentication stays in its existing client boundary; all art is owned Senryo artwork. */
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
          <a href="#product">Product</a>
          <a href="#predictions">Predictions</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className={styles.headerActions}>
          <LandingMenu className={styles.mobileMenu} />
          <a href="#start" className={styles.smallButton}>
            Get the beta <ArrowUpRight size={17} aria-hidden />
          </a>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Senryo for iPhone · Built on Monad</p>
            <h1 id="hero-title">
              Markets. Predictions.
              <br />
              In your pocket.
            </h1>
            <p className={styles.intro}>
              Trade gold, silver and currency pairs with paper funds. Explore crypto markets, follow predictions and
              manage your money in one mobile app on Monad.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="#start">
                Get the iOS beta <ArrowRight size={19} aria-hidden />
              </a>
              <a href="#product" className={styles.textLink}>
                See the app <ArrowRight size={18} aria-hidden />
              </a>
            </div>
            <p className={styles.betaNote}>iOS beta via TestFlight · Practice funds have no cash value</p>
          </div>
          <figure className={styles.mobileHero}>
            <div className={styles.phoneBack}>
              <Image
                src="/brand/website/mobile-markets.png"
                alt="Senryo iOS beta: gold, silver, currency and crypto market pairs"
                width={1206}
                height={2622}
                preload
                className={styles.phoneScreen}
              />
            </div>
            <div className={styles.phoneFront}>
              <Image
                src="/brand/website/mobile-predict.png"
                alt="Senryo iOS beta: prediction questions with indicative Yes and No prices"
                width={1206}
                height={2622}
                preload
                className={styles.phoneScreen}
              />
            </div>
            <figcaption>Actual iOS beta screens · Market prices change</figcaption>
          </figure>
        </section>

        <section id="product" className={styles.product} aria-labelledby="product-title">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>The product</p>
            <h2 id="product-title">
              Your markets.
              <br />
              Your money. One app.
            </h2>
          </div>
          <div className={styles.feature}>
            <div className={styles.walletArt}>
              <span className={styles.artCaption}>A place for what’s yours.</span>
              <Image
                src="/brand/website/balance.webp"
                alt="Senryo’s gold and lacquer wallet chest"
                width={1134}
                height={1410}
                className={styles.chest}
              />
              <span className={styles.artSignature}>{BRAND.kanji}</span>
            </div>
            <div className={styles.featureCopy}>
              <p className={styles.eyebrow}>01 / Your account</p>
              <h3>
                See what you hold.
                <br />
                Know where it sits.
              </h3>
              <p>
                Your wallet, trading positions and activity live together. Send, receive or swap from the plus button,
                and open any transaction for its details and a Senryo receipt.
              </p>
              <a href="#start" className={styles.textLink}>
                Try the mobile beta <ArrowRight size={18} aria-hidden />
              </a>
              <p className={styles.smallNote}>Sign in with a passkey. Keep a backup for another way back in.</p>
            </div>
          </div>
        </section>

        <section id="practice" className={styles.practice} aria-labelledby="practice-title">
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>02 / Practice first</p>
            <h2 id="practice-title">
              Make a move.
              <br />
              Make it Practice.
            </h2>
            <p>
              Start with paper funds on Monad Testnet. Go long or short on supported pairs, set take-profit and
              stop-loss, and follow your position from entry to close.
            </p>
            <a href="#start" className={`${styles.whiteButton} ${styles.practiceAction}`}>
              Try Practice on iOS <ArrowRight size={19} aria-hidden />
            </a>
            <p className={styles.smallNote}>Paper funds. Real market movements. No cash value.</p>
          </div>
          <div className={styles.marketList}>
            <p className={styles.listCaption}>Find your first market</p>
            <a href="#start">
              <span className={styles.marketNumber}>01</span>
              <span>
                Gold <small>XAU</small>
              </span>
              <ArrowUpRight size={26} aria-hidden />
            </a>
            <a href="#start">
              <span className={styles.marketNumber}>02</span>
              <span>
                Silver <small>XAG</small>
              </span>
              <ArrowUpRight size={26} aria-hidden />
            </a>
            <a href="#start">
              <span className={styles.marketNumber}>03</span>
              <span>
                Currencies <small>FX</small>
              </span>
              <ArrowUpRight size={26} aria-hidden />
            </a>
            <p className={styles.listNote}>Availability depends on the market and its trading hours.</p>
          </div>
        </section>

        <section id="predictions" className={styles.predictionSection} aria-labelledby="predict-title">
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>03 / Predictions</p>
            <h2 id="predict-title">
              Where will
              <br />
              the price go?
            </h2>
            <p>
              Explore Bitcoin and Ethereum price events. See the outcomes, follow their price history and read how each
              market resolves.
            </p>
            <p className={styles.smallNote}>
              Binary markets use Polymarket on Polygon. Numerical price contests use Castora on Monad. Discovery is
              live; trading, contest entry and claims are still being built.
            </p>
            <a href="#start" className={styles.textLink}>
              Explore in the iOS beta <ArrowRight size={18} aria-hidden />
            </a>
          </div>
          <figure className={styles.predictionPreview}>
            <Image
              src="/brand/website/mobile-predict.png"
              alt="The native Predict screen: readable market questions, outcome prices and filters in a drawer"
              width={1206}
              height={2622}
              className={styles.predictionPhone}
            />
            <figcaption>iOS beta · View-only discovery</figcaption>
          </figure>
        </section>

        <section className={`${styles.feature} ${styles.people}`} aria-labelledby="people-title">
          <div className={styles.portraits} aria-hidden>
            {PORTRAITS.map((portrait) => (
              <div key={portrait}>
                <Image src={`/brand/website/${portrait}.svg`} width={256} height={256} alt="" />
              </div>
            ))}
            <span className={styles.portraitCaption}>Your own point of view.</span>
          </div>
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>04 / People & perspectives</p>
            <h2 id="people-title">
              There’s a person
              <br />
              behind every move.
            </h2>
            <p>
              Find people, follow their public activity and share your profile. See how others approach the same
              markets, then make your own decisions.
            </p>
            <a href="#start" className={styles.textLink}>
              Find people in the app <ArrowRight size={18} aria-hidden />
            </a>
          </div>
        </section>

        <section className={styles.cardSection} aria-labelledby="card-title">
          <div className={styles.featureCopy}>
            <p className={styles.eyebrow}>05 / Kinpaku 金箔</p>
            <h2 id="card-title">
              A little gold.
              <br />A limit you choose.
            </h2>
            <p>
              A card with a place in your wallet. In the mobile beta, set a daily limit, freeze your sandbox card and
              review your test receipts.
            </p>
            <a href="#start" className={styles.textLink}>
              Try Kinpaku on iOS <ArrowRight size={18} aria-hidden />
            </a>
            <p className={styles.smallNote}>Sandbox only. Live purchases and Apple Wallet are not available yet.</p>
          </div>
          <div className={styles.cardArt}>
            <span className={styles.sandboxBadge}>The Kinpaku sandbox</span>
            <Image
              src="/brand/website/kinpaku.png"
              alt="Kinpaku’s gold-leaf card with Senryo seal on dark lacquer"
              width={1200}
              height={758}
              className={styles.cardImage}
            />
            <span className={styles.cardCaption}>金箔 / Gold leaf</span>
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

        <section id="start" className={styles.entry} aria-labelledby="start-title">
          <div>
            <p className={styles.eyebrow}>Welcome to Senryo</p>
            <h2 id="start-title">
              Take Senryo
              <br />
              with you.
            </h2>
            <p>
              The iOS beta is available through TestFlight invitations.
              <br />
              Request access, then start in Practice.
            </p>
          </div>
          <div className={styles.betaAccess}>
            <a href={BETA_REQUEST} className={styles.whiteButton}>
              Request iOS beta access <ArrowUpRight size={18} aria-hidden />
            </a>
            <p>Opens an email to support@senryo.xyz</p>
            <details className={styles.browserPreview}>
              <summary>
                Or open the browser preview <Plus size={18} aria-hidden />
              </summary>
              <div className={styles.accountActions}>
                <WelcomeActions />
              </div>
            </details>
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
            <Link href={ROUTES.stats} prefetch={false}>
              Public stats
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
          Senryo is a mobile beta. Practice funds have no cash value. Mainnet trading, prediction execution and live
          card spending are not enabled. Trading involves risk.
        </p>
        <span className={styles.footerWordmark} aria-hidden>
          Senryo
        </span>
      </footer>
    </div>
  );
}
