## Our analysis (not official; each claim cites its source)

### What the judges score (track page rubric)
*"This track's central bar is an invisible blockchain — judge harshly on any point of friction that reveals 'this is crypto.'"* Founder & Market Readiness is 25%: name a specific consumer segment. Traction: *"even five friends trying it"* plus *"how would the next 100 users actually find this?"*

### Bounty combinations that are valid for Track 02
| Build | Bounties it can claim | Watch out |
|---|---|---|
| Cross-border payments app | **Agora Cross-Border $10K** (Track 02 only; *"mobile app letting users send AUSD across borders using **Mera passkey onboarding** and instant settlement"*; judged on implementation, real-world usability, business viability) + Mera UX $2.5K + Aurora $5K (any-chain deposits) | Must be **mobile**, use **Mera** and **AUSD**. Our research found 7+ public competitor repos in remittance ([ecosystem-map](../05-ecosystem/ecosystem-map.md), unverified count) |
| Any consumer money app | Privy $5K (*"login-only integrations will not qualify"*) **or** Dynamic $5K (needs a ≤3-min demo link of the Dynamic flow) + Mera ×2 ($2.5K each) + Aurora $5K + Envio $1K + Alchemy credits | Privy and Dynamic both require going beyond basic login |

**Note:** Agora **Mobile Trading** ($10K) is **Track 01 only**. It's not available in Track 02.

### Mapping the official ideas to tools
| Official idea | Monad building blocks (see sponsor files) |
|---|---|
| Salary streaming / pay every second | Sablier is deployed on Monad mainnet: [../03-sponsors/wallets-payments/payment-patterns.md](../03-sponsors/wallets-payments/payment-patterns.md) |
| Payments as social gestures, programmable gifts | AUSD (gasless ERC-3009 transfers) + passkey login (Mera/Privy) + gas sponsorship |
| Commitment contracts / accountability pools | Escrow contracts + an attestation/oracle source; Chainlink CRE ($3K) could run the verification workflow |
| Micro-insurance by the minute | Per-second accounting is cheap on Monad; needs an oracle for the insured event |
| ISAs, behaviour-gated savings | Streaming + conditional payout contracts |

### Monad traps for consumer UX
- EIP-7702-delegated accounts can't drop below **10 MON**, so hold user balances in stablecoins ([../02-monad/differences-from-ethereum.md](../02-monad/differences-from-ethereum.md)).
- Show success at the fast confirmation state and settle at finalized ([../02-monad/architecture-for-builders.md](../02-monad/architecture-for-builders.md)).
