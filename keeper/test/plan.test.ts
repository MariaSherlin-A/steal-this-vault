import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Door } from "@stv/core/attacks";
import { CONTROL_REFILL_BELOW, OWNER_RESERVE_UQOR, PROOF_OF_LIFE_EVERY_BLOCKS, RENEW_BELOW, inDrillPeriod, modeFrom, plan, type Reading } from "../src/plan";

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

const drill = (r: Reading) => plan(r, "drill").map((a) => a.kind);

describe("keeper plan, drill mode", () => {
  const shut = { ...healthyDoor, open: false };

  it("empties the control vault through the open window, then shuts it", () => {
    assert.deepEqual(drill(healthy), ["empty-control", "close-window"]);
  });

  it("opens the window briefly when it must empty the control vault", () => {
    assert.deepEqual(drill({ ...healthy, door: shut }), ["open-window", "empty-control", "close-window"]);
    assert.deepEqual(drill({ ...healthy, door: { ...healthyDoor, targets: [vaults.hybrid] } }), ["open-window", "empty-control", "close-window"]);
  });

  it("only shuts the window when the control vault is already empty", () => {
    assert.deepEqual(drill({ ...healthy, controlBalanceWei: 0n }), ["close-window"]);
  });

  it("does nothing once both are done", () => {
    assert.deepEqual(drill({ ...healthy, door: shut, controlBalanceWei: 0n }), []);
  });

  it("never refills the control vault or withdraws from the hybrid vault", () => {
    assert.deepEqual(drill({ ...healthy, door: shut, controlBalanceWei: 0n, lastPaidAt: 0n }), []);
  });

  it("still makes the owner safer when the balance is below the reserve", () => {
    assert.deepEqual(drill({ ...healthy, ownerLiquidUqor: 0n }), ["empty-control", "close-window"]);
  });
});

describe("keeper mode", () => {
  it("defaults to normal", () => {
    assert.equal(modeFrom([], undefined), "normal");
    assert.equal(modeFrom([], ""), "normal");
    assert.equal(modeFrom([], "normal"), "normal");
  });

  it("reads the flag before the environment", () => {
    assert.equal(modeFrom(["--drill"], "normal"), "drill");
    assert.equal(modeFrom(["--normal"], "drill"), "normal");
    assert.equal(modeFrom([], " Drill "), "drill");
  });

  it("refuses an unknown mode instead of guessing", () => {
    assert.throws(() => modeFrom([], "drll"), /KEEPER_MODE/);
  });

  it("is in drill mode on drill day whatever the variable says", () => {
    const drillDay = new Date(Date.UTC(2026, 10, 18, 12, 0, 0));
    assert.equal(inDrillPeriod(drillDay), true);
    assert.equal(modeFrom([], "normal", drillDay), "drill");
    assert.equal(modeFrom([], undefined, drillDay), "drill");
    assert.equal(modeFrom([], "drll", drillDay), "drill", "an unknown variable cannot break drill day");
    // The margin: the evening before and the early morning after.
    assert.equal(modeFrom([], "normal", new Date(Date.UTC(2026, 10, 17, 18, 0, 0))), "drill");
    assert.equal(modeFrom([], "normal", new Date(Date.UTC(2026, 10, 19, 5, 59, 59))), "drill");
    // Outside it the variable decides again.
    assert.equal(modeFrom([], "normal", new Date(Date.UTC(2026, 10, 17, 17, 59, 59))), "normal");
    assert.equal(modeFrom([], "normal", new Date(Date.UTC(2026, 10, 19, 6, 0, 0))), "normal");
    assert.equal(inDrillPeriod(new Date(Date.UTC(2026, 10, 16, 12, 0, 0))), false);
  });

  it("lets only an explicit --normal override drill day", () => {
    const drillDay = new Date(Date.UTC(2026, 10, 18, 12, 0, 0));
    assert.equal(modeFrom(["--normal"], "drill", drillDay), "normal");
    assert.equal(modeFrom(["--drill"], "normal", drillDay), "drill");
  });
});
