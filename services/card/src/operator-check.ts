import {
  addressOf,
  CONTRACT_ABIS,
  type Hex,
  keccak256,
  type ReadClient,
  type Sender,
  stringToBytes,
} from "@senryo/chain";
import type { ChainId } from "@senryo/config";

const SELECTOR_HEX_CHARS = 10;

/** An ASA operator must be able to call immediately; a delayed AccessManager grant cannot authorize a swipe. */
export async function checkOperators(read: ReadClient, chainId: ChainId, operators: readonly Sender[]): Promise<void> {
  const core = addressOf(chainId, "SenryoCore");
  const authority = await read.readContract({
    address: core,
    abi: CONTRACT_ABIS.SenryoCore,
    functionName: "authority",
  });
  const selector = keccak256(stringToBytes("placeHold(bytes32,bytes32,address,uint128)")).slice(
    0,
    SELECTOR_HEX_CHARS,
  ) as Hex;
  for (const operator of operators) {
    const [immediate] = await read.readContract({
      address: authority,
      abi: CONTRACT_ABIS.AccessManager,
      functionName: "canCall",
      args: [operator.account.address, core, selector],
    });
    if (!immediate) throw new Error(`Card operator ${operator.account.address} cannot place holds immediately`);
  }
}
