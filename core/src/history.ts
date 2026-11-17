/**
 * The full record of attempts on a vault, read back from its event logs, and
 * the intruder file built from it: one entry per wallet that came for the money.
 *
 * `Vault.recent()` keeps only the last 16 attempts in storage and does not say
 * where each thief wanted the money sent. The `Refused` and `Paid` events do,
 * and the testnet still serves them from the deployment block onwards (checked
 * 17 Nov 2026), at most 10,000 blocks per request.
 */
import { getAbiItem, type Address, type Hex } from "viem";
import { vaultAbi } from "./abi";
import type { EvmClient } from "./evm";
import { refusalName, type RefusalName } from "./refusal";

/** The widest block range the testnet RPC answers in one `eth_getLogs`. */
export const LOG_RANGE = 10_000n;

/** How many log requests the reader has in flight at once. */
const CONCURRENCY = 6;

export interface Attempt {
  vault: Address;
  /** `refused`: the vault said no and counted it. `paid`: the vault paid out. */
  kind: "refused" | "paid";
  /** The account that sent the transaction. */
  caller: Address;
  /** Where the money was to go. */
  to: Address;
  /** In wei (the EVM lane's 18 decimals). */
  amount: bigint;
  nonce: bigint;
  refusal: RefusalName;
  /** Whether the attempt carried the owner's secp256k1 authority (always true for a payment). */
  keyholder: boolean;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}

/** Split [from, to] into ranges the RPC accepts. */
export function pageRanges(from: bigint, to: bigint, size: bigint = LOG_RANGE): [bigint, bigint][] {
  const ranges: [bigint, bigint][] = [];
  for (let a = from; a <= to; a += size) {
    const b = a + size - 1n;
    ranges.push([a, b < to ? b : to]);
  }
  return ranges;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const REFUSED_EVENT = getAbiItem({ abi: vaultAbi, name: "Refused" });
const PAID_EVENT = getAbiItem({ abi: vaultAbi, name: "Paid" });

/** Oldest first; within a block, in log order. */
export function sortAttempts(attempts: readonly Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  );
}

/**
 * Every attempt the vault logged between two blocks, oldest first. Pass the
 * block after the last one already read to extend an earlier result.
 */
export async function readHistory(client: EvmClient, vault: Address, fromBlock: bigint, toBlock: bigint): Promise<Attempt[]> {
  if (toBlock < fromBlock) return [];
  const pages = await mapLimit(pageRanges(fromBlock, toBlock), CONCURRENCY, ([a, b]) =>
    client.getLogs({ address: vault, events: [REFUSED_EVENT, PAID_EVENT], fromBlock: a, toBlock: b, strict: true }),
  );
  const attempts: Attempt[] = [];
  for (const log of pages.flat()) {
    if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) continue;
    if (log.eventName === "Refused") {
      attempts.push({
        vault,
        kind: "refused",
        caller: log.args.caller,
        to: log.args.to,
        amount: log.args.amount,
        nonce: log.args.nonce,
        refusal: refusalName(log.args.reason),
        keyholder: log.args.keyholder,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
      });
    } else {
      attempts.push({
        vault,
        kind: "paid",
        caller: log.args.caller,
        to: log.args.to,
        amount: log.args.amount,
        nonce: log.args.nonce,
        refusal: "None",
        keyholder: true,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
      });
    }
  }
  return sortAttempts(attempts);
}

// ---------------------------------------------------------------- the intruder file

/** The accounts the project itself uses, so they can be named instead of mistaken for strangers. */
export interface KnownAccounts {
  owner: Address;
  /** The deployer, which also relays the owner's proof-of-life withdrawals and is used in rehearsals. */
  deployer: Address;
  hybrid: Address;
  classic: Address;
}

export type Method = RefusalName | "Robbed";

export interface Intruder {
  /** The wallet that identifies this intruder: where they wanted the money sent. */
  address: Address;
  /** Set when the wallet is one of the project's own; otherwise the intruder is a stranger. */
  label: string | null;
  attempts: Attempt[];
  refused: number;
  /** Payments the one-lock vault made to this wallet. */
  robbed: number;
  /** Carried the owner's secp256k1 authority: the published key at work. */
  withPublishedKey: number;
  /** What the refused attempts asked for, in wei. */
  wantedWei: bigint;
  /** What the one-lock vault actually paid, in wei. */
  tookWei: bigint;
  firstBlock: bigint;
  lastBlock: bigint;
  /** How many times each method was used. */
  methods: Partial<Record<Method, number>>;
  /** The robberies, oldest first. */
  loot: Attempt[];
  /** Accounts that sent this intruder's transactions. */
  callers: Address[];
}

export interface IntruderFile {
  /** Most recently active first. */
  intruders: Intruder[];
  /** The owner's own withdrawals from the two-lock vault, which need both keys and are not thefts. */
  ownerWithdrawals: number;
  /** Payments from the one-lock vault back to the owner (the keeper taking the bait money back). */
  ownerCleanouts: number;
}

const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/** A name for a project account, or null for a stranger. */
export function labelFor(address: Address, known: KnownAccounts): string | null {
  if (same(address, known.owner)) return "the owner's own account";
  if (same(address, known.deployer)) return "the project's own test account";
  if (same(address, known.hybrid)) return "the two-lock vault";
  if (same(address, known.classic)) return "the one-lock vault";
  return null;
}

/**
 * Which wallet an attempt points at. Where the money was to go identifies the
 * thief; when that is the owner itself, the sender does.
 */
export function fingerprint(attempt: Attempt, known: KnownAccounts): Address {
  return same(attempt.to, known.owner) ? attempt.caller : attempt.to;
}

/** Build the file. Pure, so it can be tested without a chain. */
export function intruderFile(attempts: readonly Attempt[], known: KnownAccounts): IntruderFile {
  const byWallet = new Map<string, Intruder>();
  let ownerWithdrawals = 0;
  let ownerCleanouts = 0;

  for (const a of sortAttempts(attempts)) {
    if (a.kind === "paid" && same(a.vault, known.hybrid)) {
      ownerWithdrawals++; // only the owner, with both keys, can make the two-lock vault pay
      continue;
    }
    const wallet = fingerprint(a, known);
    if (same(wallet, known.owner)) {
      if (a.kind === "paid") ownerCleanouts++;
      continue;
    }
    const key = wallet.toLowerCase();
    let entry = byWallet.get(key);
    if (!entry) {
      entry = {
        address: wallet,
        label: labelFor(wallet, known),
        attempts: [],
        refused: 0,
        robbed: 0,
        withPublishedKey: 0,
        wantedWei: 0n,
        tookWei: 0n,
        firstBlock: a.blockNumber,
        lastBlock: a.blockNumber,
        methods: {},
        loot: [],
        callers: [],
      };
      byWallet.set(key, entry);
    }
    entry.attempts.push(a);
    entry.lastBlock = a.blockNumber;
    if (a.keyholder) entry.withPublishedKey++;
    if (!entry.callers.some((c) => same(c, a.caller))) entry.callers.push(a.caller);
    const method: Method = a.kind === "paid" ? "Robbed" : a.refusal;
    entry.methods[method] = (entry.methods[method] ?? 0) + 1;
    if (a.kind === "paid") {
      entry.robbed++;
      entry.tookWei += a.amount;
      entry.loot.push(a);
    } else {
      entry.refused++;
      entry.wantedWei += a.amount;
    }
  }

  const intruders = [...byWallet.values()].sort((x, y) => (x.lastBlock < y.lastBlock ? 1 : x.lastBlock > y.lastBlock ? -1 : 0));
  return { intruders, ownerWithdrawals, ownerCleanouts };
}

// ---------------------------------------------------------------- storage form

/** An attempt with its big numbers as decimal strings, for JSON. */
export type AttemptJson = Omit<Attempt, "amount" | "nonce" | "blockNumber"> & { amount: string; nonce: string; blockNumber: string };

export function attemptToJson(a: Attempt): AttemptJson {
  return { ...a, amount: a.amount.toString(), nonce: a.nonce.toString(), blockNumber: a.blockNumber.toString() };
}

export function attemptFromJson(j: AttemptJson): Attempt {
  return { ...j, amount: BigInt(j.amount), nonce: BigInt(j.nonce), blockNumber: BigInt(j.blockNumber) };
}
