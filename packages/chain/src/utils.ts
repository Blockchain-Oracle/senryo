/**
 * The viem primitives other workspaces need, re-exported so viem stays imported only here and in packages/account
 * (invariant `viem-import-boundary`). Pure helpers and types only — no clients.
 */
export {
  type Address,
  encodeAbiParameters,
  getAddress,
  type Hex,
  isAddress,
  isAddressEqual,
  keccak256,
  stringToBytes,
  stringToHex,
  type TransactionReceipt,
  toHex,
  zeroAddress,
} from "viem";
