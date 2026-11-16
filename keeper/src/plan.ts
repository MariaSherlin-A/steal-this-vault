/**
 * What the keeper should do on a tick, decided from what it reads. Pure, so it
 * is unit-tested without a chain.
 *
 * The owner account's EVM authorisation window is what lets visitors' attempts
 * reach the vaults from the owner account. It is opened by the real owner, with
 * both keys, and scoped to the two vaults, so the published secp256k1 key can
 * send transactions to them and to nothing else. Each attempt spends from the
 * window's fee budget, which bounds what a flood of attempts can cost.
 */
import type { Door } from "@stv/core/attacks";
import type { Address } from "viem";

/** The window the keeper opens. */
export const WINDOW = {
  /** About 6.6 hours at the testnet's 1.4 s blocks, just under the chain's ceiling of 17,280. GitHub runs the
   * schedule only every few hours, so the window has to outlast the gap between ticks. */
  blocks: 17_000n,
  /** Attempts admitted per window. */
  maxTxs: 400n,
  /** Fee budget per window, in uqor (0.5 QOR). A refused attempt costs about 0.01 QOR at 100 gwei. */
  maxValueUqor: 500_000n,
} as const;

/** Reopen when the window is this close to running out. */
export const RENEW_BELOW = { blocks: 1_200n, txs: 25n, valueUqor: 40_000n } as const;

/** Make a proof-of-life withdrawal when the last one is older than this many blocks (about 24 hours). */
export const PROOF_OF_LIFE_EVERY_BLOCKS = 60_000n;

/** Refill the control vault when it is below this, in wei (0.02 QOR). */
export const CONTROL_REFILL_BELOW = 20_000_000_000_000_000n;
export const CONTROL_REFILL_TO_UQOR = 50_000n;

/** The keeper stops if the owner's liquid balance falls below this, in uqor (3 QOR). */
export const OWNER_RESERVE_UQOR = 3_000_000n;

/**
 * `normal`: keep the experiment open to visitors.
 * `drill`: for the fest's Q-Day drill, when a bot holds the published key and every
 * successful attack or lost coin counts against the project. The side door is shut,
 * so attempts are refused at the door and cost the owner no fees, and the one-lock
 * control vault is emptied back to the owner, because it opens for the published key
 * by design, through any account, door or no door.
 */
export type Mode = "normal" | "drill";

export function modeFrom(argv: readonly string[], env: string | undefined): Mode {
  if (argv.includes("--drill")) return "drill";
  if (argv.includes("--normal")) return "normal";
  const value = (env ?? "").trim().toLowerCase();
  if (value === "" || value === "normal") return "normal";
  if (value === "drill") return "drill";
  throw new Error(`KEEPER_MODE must be "normal" or "drill", not "${env}"`);
}

export interface Reading {
  door: Door;
  vaults: { hybrid: Address; classic: Address };
  currentBlock: bigint;
  lastPaidAt: bigint;
  hybridBalanceWei: bigint;
  controlBalanceWei: bigint;
  ownerLiquidUqor: bigint;
}

export type Action =
  | { kind: "open-window"; reason: string }
  | { kind: "proof-of-life"; reason: string }
  | { kind: "refill-control"; reason: string }
  | { kind: "close-window"; reason: string }
  | { kind: "empty-control"; reason: string }
  | { kind: "stop"; reason: string };

export function sameTargets(door: Door, vaults: { hybrid: Address; classic: Address }): boolean {
  const want = [vaults.hybrid, vaults.classic].map((a) => a.toLowerCase()).sort();
  const have = door.targets.map((a) => a.toLowerCase()).sort();
  return want.length === have.length && want.every((a, i) => a === have[i]);
}

export function plan(r: Reading, mode: Mode = "normal"): Action[] {
  if (mode === "drill") return planDrill(r);
  if (r.ownerLiquidUqor < OWNER_RESERVE_UQOR) {
    return [{ kind: "stop", reason: `owner liquid balance ${r.ownerLiquidUqor} uqor is below the reserve` }];
  }
  const actions: Action[] = [];

  if (!r.door.open) {
    actions.push({ kind: "open-window", reason: "no live window" });
  } else if (!sameTargets(r.door, r.vaults) || r.door.nativeOnly) {
    actions.push({ kind: "open-window", reason: "the live window is not scoped to the two vaults" });
  } else if (r.door.remainingBlocks < RENEW_BELOW.blocks) {
    actions.push({ kind: "open-window", reason: `${r.door.remainingBlocks} blocks left` });
  } else if (r.door.remainingTxs < RENEW_BELOW.txs) {
    actions.push({ kind: "open-window", reason: `${r.door.remainingTxs} transactions left` });
  } else if (r.door.remainingValueUqor < RENEW_BELOW.valueUqor) {
    actions.push({ kind: "open-window", reason: `${r.door.remainingValueUqor} uqor of fee budget left` });
  }

  if (r.hybridBalanceWei > 0n && (r.lastPaidAt === 0n || r.currentBlock - r.lastPaidAt > PROOF_OF_LIFE_EVERY_BLOCKS)) {
    actions.push({
      kind: "proof-of-life",
      reason: r.lastPaidAt === 0n ? "no withdrawal yet" : `last withdrawal ${r.currentBlock - r.lastPaidAt} blocks ago`,
    });
  }

  if (r.controlBalanceWei < CONTROL_REFILL_BELOW) {
    actions.push({ kind: "refill-control", reason: `control vault holds ${r.controlBalanceWei} wei` });
  }
  return actions;
}

/**
 * Drill mode empties the one-lock vault back to the owner (the owner calls it over
 * the EVM, which needs the window for one transaction), then shuts the window so
 * every attempt is refused at the door at no cost to the owner. It runs even below
 * the reserve, because each step leaves the owner safer.
 */
function planDrill(r: Reading): Action[] {
  const actions: Action[] = [];
  const mustEmpty = r.controlBalanceWei > 0n;
  // The owner empties the control vault itself, over the EVM, so it needs a window that admits the vault.
  if (mustEmpty && !doorAdmitsVault(r.door, r.vaults.classic)) {
    actions.push({ kind: "open-window", reason: "drill mode: briefly, so the owner can empty the one-lock vault" });
  }
  if (mustEmpty) {
    actions.push({
      kind: "empty-control",
      reason: `drill mode: the one-lock vault holds ${r.controlBalanceWei} wei that the published key can take`,
    });
  }
  if (r.door.open || mustEmpty) {
    actions.push({ kind: "close-window", reason: "drill mode: attempts must be refused at the door, at no cost to the owner" });
  }
  return actions;
}

function doorAdmitsVault(door: Door, vault: Address): boolean {
  if (!door.open || door.nativeOnly || door.remainingTxs === 0n || door.remainingBlocks < 50n) return false;
  return door.targets.length === 0 || door.targets.some((t) => t.toLowerCase() === vault.toLowerCase());
}
