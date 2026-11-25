/**
 * The heavy half: the native lane and the attack runner, which pull in the
 * QoreChain SDK and the ML-DSA-87 implementation. Loaded with `loadLab()`.
 *
 * The runner is the same module the command-line tool uses, so an attempt made
 * here is the attempt `npm run heist` makes.
 */
import { createAttackContext, readDoor, runAttack, type AttackContext, type AttackResult, type Door } from "@stv/core/attacks";
import { TESTNET } from "@stv/core/chain";
import { NativeLane, nativeAddress } from "@stv/core/native";
import { EVM_MODULE_ACCOUNT, followMoney, type Trail } from "@stv/core/trail";
import { PUBLISHED_KEY } from "@stv/core/published";
import type { Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { DEPLOYMENT, OWNER, REST, VAULTS } from "./clients";

export type { AttackContext, AttackResult, Door };

export const lane = new NativeLane({ rest: REST });

/** The owner account's EVM window and liquid balance, as the chain reports them. */
export async function readOwner(): Promise<{ door: Door; liquidUqor: bigint }> {
  const [door, liquidUqor] = await Promise.all([readDoor(lane, OWNER.native), lane.balance(OWNER.native)]);
  return { door, liquidUqor };
}

/** A fresh address for stolen funds. Its key is thrown away at once, so nobody can spend what lands there. */
export function throwawayAddress(): Address {
  return privateKeyToAccount(generatePrivateKey()).address;
}

/** What every visitor attacks with: the published key and nothing else. */
export function attackContext(loot: Address, record: boolean): AttackContext {
  return createAttackContext({
    key: PUBLISHED_KEY,
    owner: OWNER,
    vaults: VAULTS,
    loot,
    rest: REST,
    evmRpc: TESTNET.evmRpc,
    record,
  });
}

export { runAttack };

/** Whether an account has a post-quantum key on record. */
export async function secondLock(nativeAddress: string): Promise<{ registered: boolean; proven: boolean }> {
  const status = await lane.pqcStatus(nativeAddress);
  return { registered: status.registered, proven: status.possessionProven === true };
}

export function nativeBalance(nativeAddress: string): Promise<bigint> {
  return lane.balance(nativeAddress);
}

// ---------------------------------------------------------------- the money trail

/** Plain names for the accounts a trail may run into, in their native (qor1...) form. */
export const KNOWN_NATIVE: Record<string, string> = {
  [OWNER.native]: "the owner's own account",
  [DEPLOYMENT.deployer.native]: "the project's own test account",
  [nativeAddress(VAULTS.hybrid)]: "the two-lock vault",
  [nativeAddress(VAULTS.classic)]: "the one-lock vault",
  [EVM_MODULE_ACCOUNT]: "a vault paying out: the chain files every contract payment under this address",
};

export type { Trail };

/** Who funded this wallet and where its money went afterwards, from the robbery onwards. */
export function followTrail(wallet: Address, sinceBlock: bigint): Promise<Trail> {
  return followMoney(lane, nativeAddress(wallet), { sinceHeight: sinceBlock });
}

// ---------------------------------------------------------------- the drill proof

/** What the chain says about the drill-day proof payment, read live. Null when the node does not have it. */
export interface Proof {
  height: bigint;
  accepted: boolean;
  time: string;
  /** Whether the transaction carries the second, post-quantum signature. */
  twoSignatures: boolean;
  uqor: bigint;
  to: string;
}

export async function readProof(hash: string): Promise<Proof | null> {
  const found = await lane.tx(hash);
  const r = found?.tx_response;
  if (!found || !r) return null;
  const body = (found.tx?.body ?? {}) as {
    messages?: { amount?: { amount: string }[]; to_address?: string }[];
    extension_options?: { "@type"?: string }[];
    non_critical_extension_options?: { "@type"?: string }[];
  };
  const ext = [...(body.extension_options ?? []), ...(body.non_critical_extension_options ?? [])];
  const msg = body.messages?.[0];
  return {
    height: BigInt(r.height ?? "0"),
    accepted: Number(r.code) === 0,
    time: String((r as { timestamp?: string }).timestamp ?? ""),
    twoSignatures: ext.some((e) => (e["@type"] ?? "").includes("PQCHybridSignature")),
    uqor: BigInt(msg?.amount?.[0]?.amount ?? "0"),
    to: msg?.to_address ?? "",
  };
}
