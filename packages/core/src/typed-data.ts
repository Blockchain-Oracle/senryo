/**
 * EIP-712 definitions of every user signature our contracts verify — plain data, transcribed from the Solidity
 * typehashes (the contracts are the source of truth; a mismatch makes the onchain `ecrecover` fail):
 *  - StarterDrip  `EIP712("SenryoStarterDrip", "1")`  Claim · Voucher            (contracts/src/periphery/StarterDrip.sol)
 *  - SenryoCore   `EIP712("SenryoCore", "1")`         SpendAllowance · TriggerOrder (CardModule.sol, TriggerOrders.sol)
 *  - IntentRouter `EIP712("SenryoIntentRouter", "1")` OpenOrder                   (IntentRouter.sol)
 * `packages/account` signs these; `packages/chain` verifies them before a relay. The domain adds `chainId` and
 * `verifyingContract` (the deployed address from `@senryo/contracts`).
 */

export const EIP712_DOMAINS = {
  starterDrip: { name: "SenryoStarterDrip", version: "1" },
  core: { name: "SenryoCore", version: "1" },
  intentRouter: { name: "SenryoIntentRouter", version: "1" },
} as const;

/** `keccak256("Claim(address user,uint64 deadline)")` */
export const CLAIM_TYPES = {
  Claim: [
    { name: "user", type: "address" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** `keccak256("Voucher(address user,bytes32 codeHash,uint64 deadline)")` — `codeHash = keccak256(bytes(code))`. */
export const VOUCHER_TYPES = {
  Voucher: [
    { name: "user", type: "address" },
    { name: "codeHash", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** `keccak256("SpendAllowance(address user,uint128 dailyLimit,uint64 expiry,uint64 nonce)")` — nonce = `allowanceNonce(user)`. */
export const SPEND_ALLOWANCE_TYPES = {
  SpendAllowance: [
    { name: "user", type: "address" },
    { name: "dailyLimit", type: "uint128" },
    { name: "expiry", type: "uint64" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

export const TRIGGER_ORDER_TYPES = {
  TriggerOrder: [
    { name: "user", type: "address" },
    { name: "marketId", type: "uint8" },
    { name: "isLong", type: "bool" },
    { name: "takeProfit", type: "bool" },
    { name: "triggerPrice18", type: "uint128" },
    { name: "sizeDelta", type: "uint128" },
    { name: "acceptablePrice18", type: "uint128" },
    { name: "expiry", type: "uint64" },
    { name: "salt", type: "uint64" },
  ],
} as const;

export const OPEN_ORDER_TYPES = {
  OpenOrder: [
    { name: "user", type: "address" },
    { name: "marketId", type: "uint8" },
    { name: "isLong", type: "bool" },
    { name: "notionalUsd6", type: "uint256" },
    { name: "acceptablePrice18", type: "uint256" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

/** How long a relayed claim/voucher signature stays valid (the API rejects longer deadlines). */
export const RELAY_SIGNATURE_MAX_TTL_SECONDS = 600;
