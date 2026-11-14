/** Argument parsing and text output for the CLI. No network access here, so it can be unit-tested. */
import { ATTACKS, GROUPS, attackInfo, type AttackGroup } from "@stv/core";
import type { AttackResult, Door } from "@stv/core/attacks";
import { formatEther, formatUnits, isAddress, isHex, type Address, type Hex } from "viem";

export interface Options {
  record: boolean;
  json: boolean;
  list: boolean;
  help: boolean;
  only?: string[];
  loot?: Address;
  key?: Hex;
  rest?: string;
  evmRpc?: string;
}

export const USAGE = `heist: try to rob the vault with nothing but the published key

  npm run heist                       run every attack; vault-level ones are checked by simulation
  npm run heist -- --record           also put vault-level attempts on chain while the owner's
                                      EVM window is open (they land in the vault's counters)
  npm run heist -- --only vault-forged,control-rob
  npm run heist -- --list             list the attacks and stop
  npm run heist -- --json             machine-readable results

Options
  --loot 0x...      address stolen funds would go to (default: a fresh throwaway)
  --key 0x...       secp256k1 private key to attack with (default: the published one)
  --rest URL        native REST endpoint          (default: the public testnet)
  --evm-rpc URL     EVM JSON-RPC endpoint         (default: the public testnet)

Exit status is 0 when every attack ended the way it is expected to (refused,
or for the control vault, paid), and 1 otherwise.`;

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { record: false, json: false, list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value`);
      return v;
    };
    switch (arg) {
      case "--record":
        options.record = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--list":
        options.list = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--only": {
        const ids = value().split(",").map((s) => s.trim()).filter(Boolean);
        for (const id of ids) attackInfo(id); // throws on an unknown id
        options.only = ids;
        break;
      }
      case "--loot": {
        const v = value();
        if (!isAddress(v)) throw new Error("--loot must be a 0x address");
        options.loot = v;
        break;
      }
      case "--key": {
        const v = value();
        if (!isHex(v) || v.length !== 66) throw new Error("--key must be 0x followed by 64 hex characters");
        options.key = v;
        break;
      }
      case "--rest":
        options.rest = value();
        break;
      case "--evm-rpc":
        options.evmRpc = value();
        break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }
  return options;
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
export const c = { dim: paint(2), red: paint(31), green: paint(32), yellow: paint(33), bold: paint(1) };

export const qor = (wei: bigint) => `${formatEther(wei)} QOR`;

export function describeDoor(door: Door): string {
  if (!door.open) return "closed (the owner account cannot send EVM transactions at all)";
  const scope = door.nativeOnly
    ? "plain transfers only"
    : door.targets.length === 0
      ? "any target"
      : `only to ${door.targets.join(", ")}`;
  return `open, ${scope}; ${door.remainingTxs} transactions, ${formatUnits(door.remainingValueUqor, 6)} QOR and ${door.remainingBlocks} blocks left`;
}

export function listAttacks(): string {
  const lines: string[] = [];
  for (const group of Object.keys(GROUPS) as AttackGroup[]) {
    lines.push("", c.bold(GROUPS[group].title), c.dim(`  ${GROUPS[group].technical}`));
    for (const a of ATTACKS.filter((x) => x.group === group)) {
      lines.push(`  ${a.id.padEnd(22)} ${a.title}`);
    }
  }
  return lines.join("\n");
}

/** One result as two or three lines of text. */
export function formatResult(result: AttackResult): string {
  const info = attackInfo(result.id);
  const label =
    result.verdict === "refused"
      ? c.green("REFUSED  ")
      : result.verdict === "succeeded"
        ? info.expects === "paid"
          ? c.yellow("ROBBED   ")
          : c.red("SUCCEEDED")
        : c.dim("SKIPPED  ");
  const who = result.by ? `by the ${result.by}` : "";
  const code = result.code ? `[${result.code}]` : "";
  const flag = result.ok ? "" : c.red("  <-- NOT EXPECTED");
  const lines = [`${label} ${info.title}${flag}`];
  lines.push(c.dim(`          ${[who, code, `(${result.mode})`].filter(Boolean).join(" ")}`));
  lines.push(c.dim(`          ${result.detail}`));
  if (result.loot && result.loot > 0n) lines.push(c.dim(`          took ${qor(result.loot)}`));
  if (result.txHash) lines.push(c.dim(`          tx ${result.txHash}`));
  if (result.note) lines.push(c.dim(`          note: ${result.note}`));
  return lines.join("\n");
}

export interface Summary {
  total: number;
  refused: number;
  robbed: number;
  skipped: number;
  unexpected: number;
}

export function summarise(results: readonly AttackResult[]): Summary {
  return {
    total: results.length,
    refused: results.filter((r) => r.verdict === "refused").length,
    robbed: results.filter((r) => r.verdict === "succeeded" && attackInfo(r.id).expects === "paid").length,
    skipped: results.filter((r) => r.verdict === "skipped").length,
    unexpected: results.filter((r) => !r.ok).length,
  };
}

/** JSON cannot hold bigint; print them as decimal strings. */
export const jsonReplacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

// ---------------------------------------------------------------- status

/** What `npm run status` reads from the chain. */
export interface VaultReport {
  label: string;
  address: Address;
  postQuantum: boolean;
  balance: bigint;
  paidCount: bigint;
  paidTotal: bigint;
  refusedCount: bigint;
  keyholderRefusedCount: bigint;
  counterfactualThefts: bigint;
  counterfactualLoss: bigint;
  lastPaidAt: bigint;
  lastRefusedAt: bigint;
  refusedBy: Record<string, bigint>;
}

export interface StatusReport {
  network: string;
  evmChainId: number;
  block: bigint;
  owner: {
    evm: Address;
    native: string;
    liquidUqor: bigint;
    pqcRegistered: boolean;
    possessionProven: boolean;
  };
  door: Door;
  vaults: VaultReport[];
}

/** "about 3 h ago" from a block distance, at the testnet's 1.4 s blocks. */
export function ago(block: bigint, current: bigint): string {
  if (block === 0n) return "never";
  const seconds = Number(current > block ? current - block : 0n) * 1.4;
  if (seconds < 90) return `block ${block}, about ${Math.round(seconds)} s ago`;
  if (seconds < 5400) return `block ${block}, about ${Math.round(seconds / 60)} min ago`;
  if (seconds < 172_800) return `block ${block}, about ${(seconds / 3600).toFixed(1)} h ago`;
  return `block ${block}, about ${(seconds / 86_400).toFixed(1)} days ago`;
}

function formatVault(v: VaultReport, block: bigint): string[] {
  const lines = [
    c.bold(`${v.label}  ${v.address}`),
    `  locks            ${v.postQuantum ? "secp256k1 and ML-DSA-87" : "secp256k1 only (the control)"}`,
    `  holds            ${qor(v.balance)}`,
    `  paid             ${v.paidCount} withdrawal${v.paidCount === 1n ? "" : "s"}, ${qor(v.paidTotal)} in total`,
    `  last paid        ${ago(v.lastPaidAt, block)}`,
    `  refused          ${v.refusedCount} attempt${v.refusedCount === 1n ? "" : "s"}, ${v.keyholderRefusedCount} of them holding the owner's secp256k1 key`,
    `  last refused     ${ago(v.lastRefusedAt, block)}`,
  ];
  if (v.postQuantum) {
    lines.push(
      `  would have lost  ${qor(v.counterfactualLoss)} over ${v.counterfactualThefts} attempt${v.counterfactualThefts === 1n ? "" : "s"} that only the ML-DSA-87 check stopped`,
    );
  }
  const reasons = Object.entries(v.refusedBy).filter(([name, count]) => name !== "None" && count > 0n);
  for (const [name, count] of reasons) lines.push(c.dim(`    ${name.padEnd(22)} ${count}`));
  return lines;
}

/** The whole status report as text. */
export function formatStatus(s: StatusReport): string {
  const key = s.owner.pqcRegistered
    ? s.owner.possessionProven
      ? c.green("registered, with proof of possession")
      : c.yellow("registered, WITHOUT proof of possession")
    : c.red("NOT registered");
  const lines = [
    c.bold("Steal This Vault: status"),
    `network        ${s.network} (EVM chain ${s.evmChainId}), block ${s.block}`,
    `owner account  ${s.owner.evm}  (${s.owner.native})`,
    `  liquid         ${formatUnits(s.owner.liquidUqor, 6)} QOR`,
    `  ML-DSA-87 key  ${key}`,
    `  EVM window     ${describeDoor(s.door)}`,
  ];
  for (const v of s.vaults) lines.push("", ...formatVault(v, s.block));
  return lines.join("\n");
}

/** Problems worth a non-zero exit: the things that would make the public claim false. */
export function statusProblems(s: StatusReport): string[] {
  const problems: string[] = [];
  if (!s.owner.pqcRegistered) problems.push("the owner account has no ML-DSA-87 key on record");
  else if (!s.owner.possessionProven) problems.push("the owner's ML-DSA-87 key has no proof of possession");
  const hybrid = s.vaults.find((v) => v.postQuantum);
  if (!hybrid) problems.push("no hybrid vault in the report");
  else if (hybrid.balance === 0n) problems.push("the hybrid vault is empty");
  return problems;
}
