/**
 * Senryo's terms of use and privacy notice — one text for the app (J1 terms step, You → Help) and the website
 * (senryo.xyz/terms, /privacy, the store listings' policy URL). Plain language, and only
 * what the product does today. **Draft v0.1 (1 Oct 2026), written by the build team and not yet reviewed by a lawyer:
 * it must be reviewed before real money (mainnet) opens.** `LEGAL_VERSION` is stored with each acknowledgment, so a
 * change here asks again.
 */
export const LEGAL_VERSION = "2026-10-02";

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
}

export const TERMS: LegalDocument = {
  title: "Terms of use",
  updated: "1 October 2026",
  intro:
    "Senryo is an app for trading perpetual contracts on gold, silver, currencies and crypto, and for using what you hold as one balance. These terms say what Senryo is, what it is not, and what you take on by using it.",
  sections: [
    {
      heading: "What Senryo is",
      body: "Senryo is software that lets you use smart contracts on the Monad network. In Practice mode it runs on Monad’s test network with paper money that has no value. In Mainnet mode, when it opens, it uses real funds. Senryo is not a bank, a broker or an adviser, and nothing in the app is advice.",
    },
    {
      heading: "Your account is yours alone",
      body: "Your account is created from a passkey that stays with you and your passkey provider. We never hold your keys and cannot move your funds, undo a transaction, or recover an account for you. If you lose every device and every backup of your passkey, the account is gone.",
    },
    {
      heading: "Trading with leverage is risky",
      body: "Leverage multiplies losses as well as gains. A position can be liquidated, closing it at a loss with a penalty, and you can lose everything you put in. Prices come from oracles and can pause or be delayed; markets have opening hours; smart contracts can have faults. Only use money you can afford to lose.",
    },
    {
      heading: "Who can use it",
      body: "You must be an adult where you live, and using Senryo must be lawful for you there. Leveraged trading is restricted or forbidden in some countries; it is your responsibility to know your local rules. We may block access from places where we cannot offer the service.",
    },
    {
      heading: "Fees",
      body: "Trades pay a fee shown on the ticket before you confirm, and positions pay or receive funding and borrow costs shown on the position. Network fees are paid in MON; in Practice mode Senryo supplies the test MON for them.",
    },
    {
      heading: "Names, posts and conduct",
      body: "If you choose a username or post, do not impersonate anyone, harass people, or post anything unlawful. We can hide content and release usernames that break these rules. Following someone never copies their trades.",
    },
    {
      heading: "No guarantees",
      body: "Senryo is provided as it is. We work to keep it correct and available, but we do not promise that it will always work, that prices are always right, or that you will not lose money. To the extent the law allows, we are not liable for losses from using it.",
    },
    {
      heading: "Changes and contact",
      body: "We may update these terms; when they change in a way that matters, the app will ask you to read them again. Questions: support@senryo.xyz.",
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy",
  updated: "2 October 2026",
  intro:
    "Senryo is built to need very little about you. This is what we keep, what we never see, and how to remove it.",
  sections: [
    {
      heading: "What we never have",
      body: "Your passkey, your private keys, your recovery phrase and your Face ID or fingerprint data never leave your device or your passkey provider. We have no password for your account because there isn’t one.",
    },
    {
      heading: "What is public by nature",
      body: "Your account’s address and everything it does onchain — deposits, trades, transfers — is public on the Monad network and cannot be deleted by anyone.",
    },
    {
      heading: "What we store",
      body: "If you set them: your username, display name, bio and avatar choice, who you follow, who you blocked or muted, your posts, likes and reports, your price alerts, and whether you chose to list your profile or share your trades on each network. To deliver notifications: this phone’s push token and the notifications sent to you. To recover your account: your backup passkey’s recovery copy, encrypted so only that passkey can open it. To credit deposits: which deposit address the app showed you. To run the service: a random id for this installation and your IP address, used for rate limits, abuse prevention and to know which country a request comes from, and app usage events. Your app preferences are stored encrypted with a key only your account has.",
    },
    {
      heading: "What we do not do",
      body: "We do not sell your data, show ads, or track you across other apps. The app asks for no tracking permission.",
    },
    {
      heading: "Deleting your data",
      body: "Settings → Delete my data removes from our servers your profile, username, follows, blocks and mutes, posts, likes and reports, your price alerts, your push tokens, your backup passkey’s recovery copy, your deposit-address watches and your encrypted preferences; your notifications lose their content and your usage events lose your address. It also clears what this phone keeps about the account. A released username is held for 30 days so nobody can pose as you. If our servers can’t be reached, this phone is cleared at once and the server part is retried the next time you sign in with that passkey. Onchain history stays, because it is not ours to remove.",
    },
    {
      heading: "Contact",
      body: "Questions or requests: support@senryo.xyz.",
    },
  ],
};
