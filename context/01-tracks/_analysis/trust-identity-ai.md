## Our analysis (not official; each claim cites its source)

### Important: this track wants infrastructure, not an app
*"Belongs here if: the primary output is a protocol, primitive, or infrastructure layer that other applications build on — not a standalone consumer product."* Design is judged as **developer experience** (docs, clean API). Traction means *"even one other team integrating it during the hackathon."* Consider recruiting another Metropolis team to integrate your primitive.

### Building blocks the track names, and what we verified
| Named in track text | Status | Where |
|---|---|---|
| Native **P256 precompile** for WebAuthn | At `0x0100`, 6,900 gas (Monad docs) | [../04-standards/passkeys-p256-webauthn.md](../04-standards/passkeys-p256-webauthn.md) |
| **ERC-8004** trustless agent registry | Identity + Reputation registries deployed on Monad mainnet (addresses verified live by our research agent); no Validation Registry found | [../04-standards/erc-8004-trustless-agents.md](../04-standards/erc-8004-trustless-agents.md) |
| **BTX encrypted mempools** | **Not researched yet.** It appears only in the portal text; we have no docs on it | To do |
| Mera (passkey → keys) | `@category-labs/mera` v0.2.0, open source | [../02-monad/mera.md](../02-monad/mera.md) |

### Bounties valid for Track 04
| Bounty | Key requirement (official) |
|---|---|
| **Cleanverse $2K** (Track 04 only) | Gate CVA asset movement behind onchain CVI identity. *"Identity verification is structurally coupled to asset movement, not added as an optional layer"* |
| **Qwen 3.8 Max $5K credits** (Track 04 only) | Credits **split across the top 3 Track 4 winners**, so you must place in the track to get them. Needs *"real agentic use"*: planning, tool use, multi-step |
| **Mera: One Passkey, Many Keys $2.5K** (All-tracks) | *"The further from 'passkey wallet,' the better."* Must pass the **cross-device test** live. Ideas include *AI agent memory encrypted to the user's passkey*, which lines up with the track's "cross-application AI memory" idea |
| **Mera-Powered UX $2.5K** (All-tracks) | Time-to-first-transaction, session design, the "stateless test" |
| Other All-tracks | Privy/Dynamic, Aurora, Envio, Nansen, Kimi, Chainlink CRE, Alchemy, Perpl API, Community |

**Note:** the MetaMask Agent Wallet bounty is **Track 01 only**, even though it mentions x402 and ERC-8004.

### Where official ideas and research overlap
- **User-owned AI memory encrypted to a passkey:** hits official idea 04 + the Mera "Many Keys" bounty + Qwen/Kimi if the agent uses them.
- **Mobile proof of personhood with WebAuthn/P256:** official idea 01, built on the P256 precompile.
- **Content passports for AI media:** official idea 02. Our research found no Monad project doing media provenance ([../04-standards/media-provenance.md](../04-standards/media-provenance.md)).
- Crowded: our research counted 10+ public repos building ERC-8004 agent identity or reputation (unverified count). Note that ERC-8004 reputation **isn't one of the 7 official ideas** here.
