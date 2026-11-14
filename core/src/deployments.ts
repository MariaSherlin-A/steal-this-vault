import type { Address, Hex } from "viem";
import testnet from "../../deployments/testnet.json";
import { TESTNET } from "./chain";
import type { VaultRef } from "./intent";

export interface DeployedVault {
  address: Address;
  /** The same contract account on the native lane, where it can be funded. */
  native: string;
  postQuantum: boolean;
  deployTx: Hex;
  deployBlock: number;
}

export interface Deployment {
  network: string;
  evmChainId: number;
  owner: { evm: Address; native: string };
  deployer: { evm: Address; native: string };
  vaults: { hybrid: DeployedVault; classic: DeployedVault };
  compiler: string;
  deployedAt: string;
}

/** The live deployment on QoreChain testnet. Written by contracts/scripts/deploy.ts. */
export const deployment = testnet as Deployment;

export const HYBRID_VAULT = deployment.vaults.hybrid.address;
export const CLASSIC_VAULT = deployment.vaults.classic.address;

export function vaultRef(which: "hybrid" | "classic"): VaultRef {
  return { address: deployment.vaults[which].address, chainId: TESTNET.evmChainId, owner: deployment.owner.evm };
}
