# Binary prediction read API (4C1a)

This API serves the owned MON-backed testnet ledger, separately from `/v1/predictions` provider discovery. The public runtime uses only `BINARY_PUBLIC_DEPLOYMENTS`, which remains empty. No environment flag, HTTP field or RPC URL activates a fixture. `BinaryPredictions` accepts fixed sources for trusted local HTTP tests; the executable service always uses `createBinaryPredictions(chains)` with the `public-api` consumer and both development flags false.

All routes are unauthenticated, rate-limited public onchain reads. Every request requires `chainId=10143`. Unknown query fields are rejected. No route signs, broadcasts, acquires proofs or authorizes spending.

| GET route under `/v1/binary-predictions` | Additional input | Result |
| --- | --- | --- |
| `/` | `asset=BTC\|ETH`, `duration=300\|900` (900 default) | Current, previous and future creatable scheduled rounds; inactive with no rounds when no approved deployment exists |
| `/:contract/:roundId` | None | Direct round snapshot; owner fields explicitly identify the immutable liquidity beneficiary |
| `/:contract/:roundId/position/:owner` | None | Direct shares, withdrawable credit and wallet MON for that owner, plus the same round snapshot |
| `/:contract/:roundId/quote` | `owner`, `side=up\|down`, `action=buy\|sell`, positive uint256 `amountWei` | Actual pinned Solidity quote and its direct snapshot |
| `/:contract/history/:owner` | Optional opaque base64url `cursor` | Verified direct source plus canonical history or explicit unavailable status |

Amounts and block numbers use decimal-string JSON codecs and decode to bigint through `createApiClient`. Source evidence carries environment ID, chain, contract, config hash, block number/hash and consensus timestamp. Market/oracle/receiver code, configuration and deployment anchor are verified before reads; the block hash is checked again after reads to reject a reorg during the request. Consensus blocks older than 15 seconds or more than 5 seconds ahead of the service clock are unavailable. This is source freshness, not finality. Clients must still use the reviewed account/chain signing guards and fresh fee/review preparation.

List discovery computes the contract's exact deterministic round ID over the bounded previous/current/creation-horizon slots for the selected asset and duration. All rows share one verified block. Old held rounds remain directly addressable by immutable ID beyond this discovery window. Round and list owner data is the beneficiary's data; use the position route for the active user's holdings.

Quotes preserve contract integer reserves, input/output, revision, marginal/execution price and impact. Sell inputs cannot exceed directly read owned shares. Closed or buy-paused rounds return 409; invalid purchase bounds and insufficient owned shares return 400. Missing rounds and unknown deployments return 404. Source or RPC failures return a redacted 503, never an invented quote. A quote does not reserve shares/MON or certify the user's gas budget.

## History handoff to 4C1b

`BinaryHistoryReader.read({manifest, owner, cursor})` is the only history seam. No reader is installed in the public composition yet. Unavailable responses contain `events: null`, `accounting: null`, `indexedBlock: null`, not an empty account history. The adapter must:

- Read only the exact environment/chain/contract/config/owner, binding cursors to that source and canonical snapshot.
- Establish complete coverage from the deployment anchor, deduplicate canonical event IDs, and roll back/rebuild positions, cost basis and credits on reorg.
- Compute account-wide weighted basis and realized results from complete canonical facts, not the returned page. Preserve credited proceeds versus successful MON transfers; withdrawals do not realize profit again.
- Return source/owner identity, `fromBlock`, and a page with indexed block/hash, events, accounting and next cursor. Transport/schema/coverage failure must return null or throw, never synthesize empty history.

The API checks returned source/owner, coverage start, indexed height and canonical indexed hash. It computes lag itself: fresh requires at most 10 blocks and 30 consensus seconds behind the direct head; otherwise data is explicitly lagging. Noncanonical/incomplete data is unavailable. The reader remains responsible for consistency between its events, account aggregate and watermark. History never feeds the quote or position path.

4C1b retains Envio schema, handlers, deployment-derived disabled configuration/codegen, GraphQL documents, canonical persistence, SQL tests and replay/reorg/basis acceptance. 4C2 proofs/keeper, 4C3 live underlying and 4D native remain separate unfinished phases. Public deployment/configuration/funding and device acceptance are not established by these source tests.

Run the disposable injected-HTTP check after building the original contract artifacts:

```sh
pnpm --filter @senryo/api exec tsx --test scripts/binary-check.ts
```

The fixture helper lives under `packages/chain/checks`, launches an ephemeral-port Anvil and terminates only that owned process. Test proof bytes are explicit FixturePyth ABI data; they are not public Pyth proof evidence. No shared fork is reset.
