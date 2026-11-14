/**
 * Randomised tampering. Start from a withdrawal the owner really signed, damage
 * it in a random way, and submit it. Nothing may be paid, ever.
 *
 * The generator is seeded, so a failure can be replayed exactly.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Refusal, type WithdrawIntent } from "@stv/core";
import { bytesToHex, hexToBytes, type Hex } from "viem";
import { QOR, deployWorld, intentFor, ownerSigns, withdraw } from "./harness/fixture";

/** mulberry32: small, fast, deterministic. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x51ea1;
const ROUNDS = 120;

describe(`vault: ${ROUNDS} random tamperings of a valid withdrawal (seed ${SEED})`, () => {
  it("none is paid, and the untouched original still is", async () => {
    const w = await deployWorld();
    const rand = prng(SEED);
    const int = (n: number) => Math.floor(rand() * n);
    const flip = (hex: Hex): Hex => {
      const bytes = hexToBytes(hex);
      const i = int(bytes.length);
      bytes[i] = bytes[i]! ^ (1 << int(8));
      return bytesToHex(bytes);
    };

    const intent = await intentFor(w, w.hybrid, { amount: 5n * QOR });
    const signed = await ownerSigns(w, w.hybrid, intent);
    const seen: Record<string, number> = {};

    for (let round = 0; round < ROUNDS; round++) {
      let i: WithdrawIntent = { ...intent };
      let classical = signed.classicalSignature;
      let pq = signed.postQuantumSignature;
      let sender = w.stranger;
      let kind: string;

      switch (int(9)) {
        case 0:
          kind = "bit flipped in the post-quantum signature";
          pq = flip(pq);
          break;
        case 1:
          kind = "bit flipped in the post-quantum signature, sent by the owner account";
          pq = flip(pq);
          sender = w.owner;
          classical = "0x";
          break;
        case 2:
          kind = "bit flipped in the classical signature";
          classical = flip(classical);
          break;
        case 3:
          kind = "amount changed";
          i = { ...i, amount: i.amount + BigInt(1 + int(1_000_000)) };
          sender = rand() < 0.5 ? w.owner : w.stranger;
          break;
        case 4:
          kind = "recipient changed";
          i = { ...i, to: bytesToHex(Uint8Array.from({ length: 20 }, () => 1 + int(255))) };
          sender = rand() < 0.5 ? w.owner : w.stranger;
          break;
        case 5:
          kind = "nonce changed";
          i = { ...i, nonce: BigInt(1 + int(50)) };
          break;
        case 6:
          kind = "deadline changed";
          i = { ...i, deadline: i.deadline + BigInt(1 + int(100_000)) };
          sender = rand() < 0.5 ? w.owner : w.stranger;
          break;
        case 7: {
          kind = "post-quantum signature truncated or padded";
          const n = 1 + int(40);
          pq = rand() < 0.5 ? (pq.slice(0, pq.length - 2 * n) as Hex) : ((pq + "ab".repeat(n)) as Hex);
          break;
        }
        default:
          kind = "post-quantum signature dropped, sent by the owner account";
          pq = "0x";
          classical = "0x";
          sender = w.owner;
      }

      const tx = await withdraw(w.hybrid, sender, i, classical, pq);
      seen[kind] = (seen[kind] ?? 0) + 1;
      assert.equal(tx.status, "success", `round ${round}: ${kind}`);
      assert.notEqual(tx.result, Refusal.None, `round ${round}: ${kind} was PAID`);
    }

    assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR, "the vault is untouched");
    assert.equal(await w.chain.balance(w.recipient), 0n);
    const stats = await w.hybrid.read("stats", []);
    assert.equal(stats.refusedCount, BigInt(ROUNDS));
    assert.equal(stats.paidCount, 0n);
    assert.ok(Object.keys(seen).length >= 8, `covered ${Object.keys(seen).length} kinds of damage`);

    // The original, undamaged, still pays: the refusals above were about the damage.
    const paid = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(paid.result, Refusal.None);
    assert.equal(await w.chain.balance(w.recipient), 5n * QOR);
  });
});
