/**
 * Plain words for what happened to an attempt. The runner's own text is
 * precise and technical; this turns it into a sentence for someone who has
 * never used a blockchain. The technical text is still shown, under "Details".
 *
 * Pure: no network, no DOM. Unit-tested.
 */
import type { AttackInfo } from "@stv/core/attack-list";
import { REFUSAL_TEXT, type RefusalName } from "@stv/core/refusal";

/** The fields of a runner result this module reads. */
export interface ResultLike {
  verdict: "refused" | "succeeded" | "skipped";
  by?: "chain" | "vault";
  code?: string;
  mode: "broadcast" | "on-chain" | "simulated";
}

/** `held`: the theft failed. `robbed`: the control vault paid, as it should. `alarm`: a theft that should have failed did not. */
export type Tone = "held" | "robbed" | "skipped" | "alarm";

export interface Explanation {
  tone: Tone;
  /** One or two words for the stamp. */
  stamp: string;
  /** Who answered, in a few words. */
  who: string;
  /** What happened, in a sentence. */
  plain: string;
}

const CHAIN_REASONS: Record<string, string> = {
  "no-window": "The side door is shut for this account, so the chain would not even look at it.",
  "target-not-allowed":
    "The owner opened the side door only as far as the two vaults. This goes somewhere else, so the chain turned it away.",
  "window-scope": "The side door, as the owner opened it, does not allow this kind of action. The chain turned it away.",
  "window-exhausted": "The side door has let through as much as the owner allowed for now. The chain turned it away.",
  "no-pqc-key": "The chain found no second key to check against, and turned it away.",
  "delegation-consent":
    "Handing an account over to a program needs the consent of the owner, signed with both keys. The chain turned it away.",
  nonce: "The chain turned it away: another attempt from the same account got in first.",
  funds: "The chain turned it away: the account could not cover the fee.",
};

function isRefusalName(code: string | undefined): code is RefusalName {
  return code !== undefined && code in REFUSAL_TEXT;
}

export function explain(result: ResultLike, info: Pick<AttackInfo, "expects">): Explanation {
  if (result.verdict === "skipped") {
    return { tone: "skipped", stamp: "Not run", who: "Not run", plain: "This one could not be tried just now." };
  }

  if (result.verdict === "succeeded") {
    const simulated = result.mode === "simulated";
    if (info.expects === "paid") {
      return {
        tone: "robbed",
        stamp: simulated ? "Would pay" : "Robbed",
        who: "The one-lock vault",
        plain: simulated
          ? "This vault would pay. One lock is all it has, and the stolen key opens it."
          : "Paid. One lock was all this vault had, and the stolen key opens it.",
      };
    }
    return {
      tone: "alarm",
      stamp: "Got through",
      who: "Unexpected",
      plain: "This attempt got through, and it should not have. That is a real finding: please report it.",
    };
  }

  // refused
  if (result.by === "vault") {
    const plain = isRefusalName(result.code) ? REFUSAL_TEXT[result.code].plain : "The vault would not take it.";
    return { tone: "held", stamp: "Refused", who: "Refused by the vault", plain };
  }
  const code = result.code ?? "";
  const plain = code.startsWith("pqc")
    ? "The chain asked for the second signature. The stolen key cannot make one, so it was turned away at the door."
    : (CHAIN_REASONS[code] ?? "The chain turned it away.");
  return { tone: "held", stamp: "Refused", who: "Refused by the chain", plain };
}

/** How an attempt was checked, in plain words. Always shown, so nothing simulated passes for recorded. */
export function modeLabel(mode: ResultLike["mode"]): { short: string; long: string } {
  switch (mode) {
    case "broadcast":
      return {
        short: "Sent to the live chain",
        long: "Signed with the published key and sent to the live network. The refusal is the network answering for itself.",
      };
    case "on-chain":
      return {
        short: "Recorded on chain",
        long: "Included in a block. The answer of the vault is in the transaction and in its public counters.",
      };
    case "simulated":
      return {
        short: "Checked live, not recorded",
        long: "Run by a network node against the current state of the chain, with the real signature check. Nothing was written, so the public counters did not move.",
      };
  }
}

export interface Tally {
  total: number;
  held: number;
  robbed: number;
  skipped: number;
  alarms: number;
}

export function tally(tones: readonly Tone[]): Tally {
  return {
    total: tones.length,
    held: tones.filter((t) => t === "held").length,
    robbed: tones.filter((t) => t === "robbed").length,
    skipped: tones.filter((t) => t === "skipped").length,
    alarms: tones.filter((t) => t === "alarm").length,
  };
}

/**
 * How many more attempts the fee allowance of the owner can put on the public
 * record. Each recorded attempt reserves up to `perAttemptUqor` of it.
 */
export function recordsLeft(
  door: { open: boolean; remainingTxs: bigint; remainingValueUqor: bigint } | null,
  perAttemptUqor = 45_000n,
): number {
  if (!door || !door.open) return 0;
  const byValue = door.remainingValueUqor / perAttemptUqor;
  return Number(byValue < door.remainingTxs ? byValue : door.remainingTxs);
}
