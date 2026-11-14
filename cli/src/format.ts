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
