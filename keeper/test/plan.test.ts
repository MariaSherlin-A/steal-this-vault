import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Door } from "@stv/core/attacks";
import { CONTROL_REFILL_BELOW, OWNER_RESERVE_UQOR, PROOF_OF_LIFE_EVERY_BLOCKS, RENEW_BELOW, plan, type Reading } from "../src/plan";

const vaults = {
  hybrid: "0x877BA271d7BdFdb7dfA0BB5863E9FBF04885c483",
  classic: "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51",
} as const;

const healthyDoor: Door = {
  open: true,
  targets: [vaults.classic, vaults.hybrid],
  nativeOnly: false,
  remainingBlocks: 8_000n,
  remainingTxs: 300n,
  remainingValueUqor: 400_000n,
  usedTxs: 100n,
  usedValueUqor: 100_000n,
  maxTxs: 400n,
  maxValueUqor: 500_000n,
  expiryHeight: 1n,
};

const healthy: Reading = {
  door: healthyDoor,
  vaults,
  currentBlock: 100_000n,
  lastPaidAt: 90_000n,
  hybridBalanceWei: 10n ** 19n,
  controlBalanceWei: 5n * 10n ** 16n,
  ownerLiquidUqor: 30_000_000n,
};

const kinds = (r: Reading) => plan(r).map((a) => a.kind);

describe("keeper plan", () => {
  it("does nothing when everything is healthy", () => {
    assert.deepEqual(kinds(healthy), []);
  });

  it("opens a window when there is none", () => {
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, open: false } }), ["open-window"]);
  });

  it("reopens a window that is not scoped to exactly the two vaults", () => {
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, targets: [] } }), ["open-window"]);
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, targets: [vaults.hybrid] } }), ["open-window"]);
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, nativeOnly: true } }), ["open-window"]);
  });

  it("accepts the targets in any order and case", () => {
    const door = { ...healthyDoor, targets: [vaults.hybrid.toLowerCase() as never, vaults.classic] };
    assert.deepEqual(kinds({ ...healthy, door }), []);
  });

  it("renews when blocks, transactions or budget run low", () => {
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, remainingBlocks: RENEW_BELOW.blocks - 1n } }), ["open-window"]);
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, remainingTxs: RENEW_BELOW.txs - 1n } }), ["open-window"]);
    assert.deepEqual(kinds({ ...healthy, door: { ...healthyDoor, remainingValueUqor: RENEW_BELOW.valueUqor - 1n } }), ["open-window"]);
  });

  it("makes a proof-of-life withdrawal when none has happened, or the last is old", () => {
    assert.deepEqual(kinds({ ...healthy, lastPaidAt: 0n }), ["proof-of-life"]);
    assert.deepEqual(kinds({ ...healthy, lastPaidAt: healthy.currentBlock - PROOF_OF_LIFE_EVERY_BLOCKS - 1n }), ["proof-of-life"]);
    assert.deepEqual(kinds({ ...healthy, lastPaidAt: healthy.currentBlock - PROOF_OF_LIFE_EVERY_BLOCKS }), []);
  });

  it("skips proof of life when the hybrid vault is empty", () => {
    assert.deepEqual(kinds({ ...healthy, lastPaidAt: 0n, hybridBalanceWei: 0n }), []);
  });

  it("refills the control vault when it has been robbed down", () => {
    assert.deepEqual(kinds({ ...healthy, controlBalanceWei: CONTROL_REFILL_BELOW - 1n }), ["refill-control"]);
  });

  it("stops, and does nothing else, when the owner's reserve is gone", () => {
    const broke = { ...healthy, ownerLiquidUqor: OWNER_RESERVE_UQOR - 1n, lastPaidAt: 0n, controlBalanceWei: 0n };
    assert.deepEqual(kinds(broke), ["stop"]);
  });

  it("combines independent actions", () => {
    const r = { ...healthy, door: { ...healthyDoor, open: false }, lastPaidAt: 0n, controlBalanceWei: 0n };
    assert.deepEqual(kinds(r), ["open-window", "proof-of-life", "refill-control"]);
  });
});
