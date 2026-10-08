/** Immutable V1 contract policy. No public deployment is currently approved. */
export const BINARY_POLICY = Object.freeze({
  version: "senryo-binary-testnet-v1",
  chainId: 10143,
  durations: [300, 900] as const,
  defaultDuration: 900,
  creationLeadMin: 30,
  creationLeadMax: 3600,
  cutoffSeconds: 10,
  boundaryTolerance: 5,
  openingDeadline: 30,
  closingDeadline: 120,
  exponent: -8,
  confidenceBps: 25,
  priceMax: 10n ** 16n,
  seedMinWei: 10n ** 19n,
  seedMaxWei: 10n ** 20n,
  buyMinWei: 10n ** 16n,
  buyMaxWei: 5n * 10n ** 18n,
  supplyCapWei: 1000n * 10n ** 18n,
  activeRoundCap: 8,
  quoteSeconds: 15,
  feeBps: 0,
  walletReserveWei: 10n * 10n ** 18n,
  btcFeed: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ethFeed: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  receiver: "0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379",
} as const);
export const BINARY_POLICY_TEXT =
  "senryo-binary-testnet-v1:chain=10143;durations=300,900;create=30,3600;cutoff=10;tolerance=5;open=30;close=120;expo=-8;confidenceBps=25;priceMax=1e16;weights=2,0|0,2|1,1;fee=0;seed=10e18,100e18;buy=1e16,5e18;supply=1000e18;active=8;quote=15;dust=locked";
export interface BinaryManifest {
  readonly version: typeof BINARY_POLICY.version;
  readonly chainId: 10143;
  readonly environment: "development-fixture" | "public-testnet";
  /** Unique workspace/deployment identity; chainId alone never identifies a fixture. */
  readonly environmentId: string;
  readonly contract: `0x${string}`;
  readonly configHash: `0x${string}`;
  readonly oracle: `0x${string}`;
  readonly receiver: typeof BINARY_POLICY.receiver;
  readonly roundCreator: `0x${string}`;
  readonly guardian: `0x${string}`;
  readonly liquidityBeneficiary: `0x${string}`;
  readonly marketCodeHash: `0x${string}`;
  readonly oracleCodeHash: `0x${string}`;
  readonly receiverCodeHash: `0x${string}`;
  readonly anchorBlock: bigint;
  readonly anchorHash: `0x${string}`;
}
export interface BinaryEnvironment {
  readonly environmentId: string;
  readonly development: boolean;
  readonly devWorkspace: boolean;
  readonly consumer: "mobile" | "local-test" | "public-api" | "keeper";
}
/** Intentionally empty: no invented contract, block, roles or bytecode. */
export const BINARY_PUBLIC_DEPLOYMENTS: readonly BinaryManifest[] = Object.freeze([]);
export function assertBinaryActivation(m: BinaryManifest, e: BinaryEnvironment): void {
  if (m.chainId !== BINARY_POLICY.chainId || m.version !== BINARY_POLICY.version || m.environmentId !== e.environmentId)
    throw new Error("binary: unsupported chain/version/environment");
  if (m.environment === "development-fixture") {
    if (
      !e.development ||
      !e.devWorkspace ||
      !["mobile", "local-test"].includes(e.consumer) ||
      !m.environmentId.startsWith("fixture:")
    )
      throw new Error("binary: development fixture unavailable to this consumer");
  } else if (!BINARY_PUBLIC_DEPLOYMENTS.includes(m)) throw new Error("binary: public deployment inactive");
}

/** ABI enum values; do not reorder without a new immutable version. */
export const BINARY_STATE = {
  Missing: 0,
  Scheduled: 1,
  Open: 2,
  OpeningInvalid: 3,
  ClosingInvalid: 4,
  Up: 5,
  Down: 6,
  Tie: 7,
  Void: 8,
} as const;
