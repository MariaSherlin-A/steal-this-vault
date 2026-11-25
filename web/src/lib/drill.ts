/**
 * The Q-Day drill, read back from the chain: which blocks fell inside the
 * fest's drill day, and what happened to the vault in them.
 */
import type { Attempt, KnownAccounts } from "@stv/core/history";

/** The fest's drill: 18 Nov 2026, 00:00:00 to 23:59:59 UTC. */
export const DRILL_START = BigInt(Date.UTC(2026, 10, 18, 0, 0, 0) / 1000);
export const DRILL_END = BigInt(Date.UTC(2026, 10, 18, 23, 59, 59) / 1000);

/** The drill-day proof payment, from docs/drill-day.md and the 18 Nov entry of docs/AI_LOG.md. */
export const PROOF_TX = "860064E01688CBCD7EF3D4D699BB8741DF4BD8894594EF2A0E6CE0A621A192AC";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface DrillTally {
  /** Attempts either vault logged inside the drill's blocks. */
  attempts: number;
  /** Refusals by the two-lock vault inside the drill. */
  refused: number;
  /** Payments by the two-lock vault to anyone but the owner: thefts that got through. */
  thefts: number;
  /** What those thefts took, in wei. */
  lostWei: bigint;
}

/** Pure: count what the vault logged between two blocks, inclusive. */
export function drillTally(attempts: readonly Attempt[], from: bigint, to: bigint, known: KnownAccounts): DrillTally {
  const inside = attempts.filter((a) => a.blockNumber >= from && a.blockNumber <= to);
  const onVault = inside.filter((a) => same(a.vault, known.hybrid));
  const thefts = onVault.filter((a) => a.kind === "paid" && !same(a.to, known.owner));
  return {
    attempts: inside.length,
    refused: onVault.filter((a) => a.kind === "refused").length,
    thefts: thefts.length,
    lostWei: thefts.reduce((sum, a) => sum + a.amount, 0n),
  };
}

/** The first block whose timestamp is at or after `time`, by binary search over block headers. */
export async function firstBlockAt(
  getTime: (block: bigint) => Promise<bigint>,
  time: bigint,
  low: bigint,
  high: bigint,
): Promise<bigint> {
  let lo = low;
  let hi = high;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if ((await getTime(mid)) < time) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}
