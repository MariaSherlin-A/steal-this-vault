import { formatEther, formatUnits } from "viem";

/** 9.999 QOR, with no trailing zeros and at most `max` decimals. */
export function qor(wei: bigint, max = 4): string {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, max).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole!;
}

export function uqorToQor(uqor: bigint, max = 3): string {
  const [whole, frac = ""] = formatUnits(uqor, 6).split(".");
  const trimmed = frac.slice(0, max).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole!;
}

/** 0xA2E4…dd73 */
export function short(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Blocks on this testnet take about 1.4 s. */
export const SECONDS_PER_BLOCK = 1.4;

export function blocksToDuration(blocks: bigint): string {
  const seconds = Number(blocks) * SECONDS_PER_BLOCK;
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/** "12 s ago", "3 min ago", "2 h ago", from a block number relative to the current one. */
export function blocksAgo(block: bigint, current: bigint): string {
  if (block === 0n) return "never";
  const diff = current > block ? current - block : 0n;
  return `${blocksToDuration(diff)} ago`;
}

export function plural(n: bigint | number, one: string, many = `${one}s`): string {
  return `${n} ${BigInt(n) === 1n ? one : many}`;
}
