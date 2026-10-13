/**
 * Help (R6.1): the questions people ask, one list for both apps — the phone's Help screen, the web's Help drawer and
 * the landing's questions, and search's Help group. `on` keeps an answer to the app it is true for.
 */
export interface HelpAnswer {
  key: string;
  q: string;
  a: string;
  on?: "web" | "phone";
  /** One of the landing page's questions. */
  landing?: true;
}

export const HELP: readonly HelpAnswer[] = [
  {
    key: "call",
    q: "What is a call?",
    a: "A call says where a price will be when a window closes: above its opening price (Up) or below it (Down). What a call pays is quoted before you make it, from the price and the time left; a right call pays that, a wrong one loses its stake.",
    landing: true,
  },
  {
    key: "ride",
    q: "What is a ride?",
    a: "A ride follows the price Up or Down with leverage for up to 4 hours, with no funding. Your margin is the most you can lose: the ride closes on its own at its knock-out price, and its profit stops at its cap — both shown before you open. Close it any time for the amount on the button.",
  },
  {
    key: "prices",
    q: "Where do the prices come from?",
    a: "Pyth. Each window opens and closes on a Pyth price print that is posted on chain, and every receipt links to the transactions that posted them, so anyone can check how a call settled.",
    landing: true,
  },
  {
    key: "pool",
    q: "Who pays the winners?",
    a: "A pool on Monad takes the other side of every call within limits the contracts enforce: how much one window can carry and how much the pool can owe at once. When a window is full, it says so.",
    landing: true,
  },
  {
    key: "practice",
    q: "What is Practice?",
    a: "Practice runs on Monad’s test network with test dollars that have no value. Every call works the same, so you can learn before Real money.",
  },
  {
    key: "real",
    q: "Is this real money?",
    a: "Practice uses free test dollars on Monad's test network: real prices, no value. Real uses USDC on Monad and opens with mainnet. A call can lose its whole stake — only call with what you can lose.",
    landing: true,
  },
  {
    key: "custody",
    q: "Who holds my money?",
    a: "You do. Your account is created from your passkey; Senryo never holds your keys and can’t move your funds or undo a transaction.",
  },
  {
    key: "cost",
    q: "What does a call cost?",
    a: "Only your stake. Senryo pays the network fee, so you never need MON. The call shows what it pays before you tap.",
  },
  {
    key: "back-in",
    q: "How do I get back in?",
    a: "Open Senryo on any phone and tap “I have an account”. Your synced passkey opens the same address. Settings → Recovery adds a backup passkey.",
    on: "phone",
  },
  {
    key: "face-id",
    q: "Why does Face ID ask?",
    a: "One Face ID turns on one-tap calls for a while, within a spending cap; it locks when you leave the app or stop. Sends, withdrawals and security changes always ask for Face ID again. Your passkey is for signing in on a new phone.",
    on: "phone",
  },
  {
    key: "app",
    q: "How do I get the app?",
    a: "Open the web app in any browser, or ask for the iPhone beta on TestFlight. Make an account with a passkey, take your test dollars, and make your first call in under a minute.",
    on: "web",
    landing: true,
  },
];

/** The answers one app shows. */
export function helpOn(app: "web" | "phone"): HelpAnswer[] {
  return HELP.filter((h) => h.on === undefined || h.on === app);
}
