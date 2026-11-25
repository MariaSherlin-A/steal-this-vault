import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Attempt, KnownAccounts } from "@stv/core/history";
import { drillTally, firstBlockAt } from "../src/lib/drill";

const known: KnownAccounts = {
  owner: "0x00000000000000000000000000000000000000a1",
  deployer: "0x00000000000000000000000000000000000000d1",
  hybrid: "0x00000000000000000000000000000000000000b1",
  classic: "0x00000000000000000000000000000000000000c1",
};

function attempt(over: Partial<Attempt>): Attempt {
  return {
    vault: known.hybrid,
    kind: "refused",
    caller: known.owner,
    to: "0x00000000000000000000000000000000000000ee",
    amount: 10n ** 16n,
    nonce: 0n,
    refusal: "PqSignatureInvalid",
    keyholder: true,
    blockNumber: 100n,
    txHash: "0x01",
    logIndex: 0,
    ...over,
  } as Attempt;
}

describe("drill", () => {
  it("counts only the drill's blocks, and only payments to strangers as thefts", () => {
    const list = [
      attempt({ blockNumber: 99n }),
      attempt({ blockNumber: 100n }),
      attempt({ blockNumber: 150n, kind: "paid", to: known.owner }),
      attempt({ blockNumber: 160n, vault: known.classic, kind: "paid" }),
      attempt({ blockNumber: 201n, kind: "paid" }),
    ];
    assert.deepEqual(drillTally(list, 100n, 200n, known), { attempts: 3, refused: 1, thefts: 0, lostWei: 0n });
    assert.deepEqual(drillTally(list, 100n, 201n, known).thefts, 1);
  });

  it("finds the first block at a time", async () => {
    const time = async (b: bigint) => 1000n + b * 2n;
    assert.equal(await firstBlockAt(time, 1010n, 0n, 100n), 5n);
    assert.equal(await firstBlockAt(time, 1011n, 0n, 100n), 6n);
  });
});
