/**
 * The heavy half: the native lane and the attack runner, which pull in the
 * QoreChain SDK and the ML-DSA-87 implementation. Loaded with `loadLab()`.
 *
 * The runner is the same module the command-line tool uses, so an attempt made
 * here is the attempt `npm run heist` makes.
 */
import { createAttackContext, readDoor, runAttack, type AttackContext, type AttackResult, type Door } from "@stv/core/attacks";
import { TESTNET } from "@stv/core/chain";
import { NativeLane } from "@stv/core/native";
import { PUBLISHED_KEY } from "@stv/core/published";
import type { Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { OWNER, REST, VAULTS } from "./clients";

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
