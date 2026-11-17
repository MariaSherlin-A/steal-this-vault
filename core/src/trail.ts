/**
 * Following the money on the native lane.
 *
 * Every transaction's `transfer` events say who paid whom, including the
 * payments a contract makes inside an EVM transaction (the vault paying a
 * thief). So for any wallet the chain can answer two questions a real
 * investigator asks: where did its first coins come from, and where did the
 * money go next. No name or address on the internet ever appears; these are
 * leads, not identities.
 */
import type { TxResponseRaw } from "./native";

/** Where the reader gets its transactions: the native lane, or a stand-in in tests. */
export interface TxSource {
  searchTxs(query: string, options?: { order?: "asc" | "desc"; limit?: number }): Promise<TxResponseRaw[]>;
  balance(address: string): Promise<bigint>;
}

export interface Transfer {
  sender: string;
  recipient: string;
  uqor: bigint;
  /** Index of the message that moved it. Fee transfers, made before any message runs, have none. */
  msgIndex: number | null;
}

export interface TxSummary {
  hash: string;
  height: bigint;
  /** ISO time from the block, or "" when the node gave none. */
  time: string;
  transfers: Transfer[];
}

/** "10000uqor" -> 10000n; anything in another denomination -> null. */
export function uqorOf(amount: string): bigint | null {
  const m = /^(\d+)uqor$/.exec(amount.trim());
  return m ? BigInt(m[1]!) : null;
}

/** The uqor transfers a transaction made, in order. */
export function transfersOf(tx: TxResponseRaw): Transfer[] {
  const out: Transfer[] = [];
  for (const event of tx.events ?? []) {
    if (event.type !== "transfer") continue;
    const attrs: Record<string, string> = {};
    for (const a of event.attributes) attrs[a.key] = a.value;
    const uqor = uqorOf(attrs.amount ?? "");
    if (!attrs.sender || !attrs.recipient || uqor === null) continue;
    out.push({ sender: attrs.sender, recipient: attrs.recipient, uqor, msgIndex: attrs.msg_index === undefined ? null : Number(attrs.msg_index) });
  }
  return out;
}

export function summarise(tx: TxResponseRaw): TxSummary {
  return { hash: tx.txhash ?? "", height: BigInt(tx.height ?? "0"), time: tx.timestamp ?? "", transfers: transfersOf(tx) };
}

export interface Funding {
  from: string;
  uqor: bigint;
  hash: string;
  height: bigint;
  time: string;
}

/** The first coins this wallet ever received, and who sent them. Null for a wallet nobody has paid. */
export async function firstFunding(source: TxSource, address: string): Promise<Funding | null> {
  const txs = await source.searchTxs(`transfer.recipient='${address}'`, { order: "asc", limit: 1 });
  for (const raw of txs) {
    const tx = summarise(raw);
    const t = tx.transfers.find((x) => x.recipient === address && x.msgIndex !== null) ?? tx.transfers.find((x) => x.recipient === address);
    if (t) return { from: t.sender, uqor: t.uqor, hash: tx.hash, height: tx.height, time: tx.time };
  }
  return null;
}

export interface Hop {
  from: string;
  to: string;
  uqor: bigint;
  hash: string;
  height: bigint;
  time: string;
}

/** Payments this wallet made, newest first. Network fees are left out. */
export async function outgoing(source: TxSource, address: string, limit = 10): Promise<Hop[]> {
  const txs = await source.searchTxs(`transfer.sender='${address}'`, { order: "desc", limit });
  const hops: Hop[] = [];
  for (const raw of txs) {
    const tx = summarise(raw);
    for (const t of tx.transfers) {
      if (t.sender !== address || t.msgIndex === null) continue;
      hops.push({ from: t.sender, to: t.recipient, uqor: t.uqor, hash: tx.hash, height: tx.height, time: tx.time });
    }
  }
  return hops;
}

export interface Trail {
  wallet: string;
  funding: Funding | null;
  /** Where the money went after the wallet, hop by hop, largest payment first at each step. */
  hops: Hop[];
  /** What the last wallet on the trail holds now, in uqor. */
  holdsUqor: bigint;
  /** The wallet the trail ends at. */
  endsAt: string;
  /** True when the trail stopped at `maxHops` rather than at a wallet that has not paid anyone. */
  cut: boolean;
}

/**
 * Follow a wallet's money: who funded it, then the largest payment it made
 * after `sinceHeight`, then the largest payment that recipient made, and so on.
 */
export async function followMoney(source: TxSource, wallet: string, options: { sinceHeight?: bigint; maxHops?: number } = {}): Promise<Trail> {
  const maxHops = options.maxHops ?? 3;
  const funding = await firstFunding(source, wallet);
  const hops: Hop[] = [];
  let at = wallet;
  let since = options.sinceHeight ?? 0n;
  let cut = false;
  const seen = new Set([wallet]);
  for (let i = 0; i < maxHops; i++) {
    const out = (await outgoing(source, at)).filter((h) => h.height >= since);
    if (out.length === 0) break;
    const next = out.reduce((best, h) => (h.uqor > best.uqor ? h : best));
    hops.push(next);
    if (seen.has(next.to)) break; // money that came back round
    seen.add(next.to);
    at = next.to;
    since = next.height;
    if (i === maxHops - 1) cut = true;
  }
  const holdsUqor = await source.balance(at);
  return { wallet, funding, hops, holdsUqor, endsAt: at, cut };
}

/**
 * When a contract pays someone inside an EVM transaction, the chain records the
 * payment as coming from its EVM module account, not from the contract. So a
 * thief's loot from the one-lock vault arrives "from" this address.
 */
export const EVM_MODULE_ACCOUNT = "qor1vqu8rska6swzdmnhf90zuv0xmelej4lqeejhp2";
