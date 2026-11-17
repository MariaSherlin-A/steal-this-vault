import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Hex } from "viem";
import { type Attempt, type KnownAccounts, attemptFromJson, attemptToJson, fingerprint, intruderFile, labelFor, pageRanges, sortAttempts } from "../src/history";

const known: KnownAccounts = {
  owner: "0xA2E46aDeDADD7163b4178Bb07AA086765e55dd73",
  deployer: "0x965cc64A84Cf6E0D7089B72Ba918d7336b5900F0",
  hybrid: "0x877BA271d7BdFdb7dfA0BB5863E9FBF04885c483",
  classic: "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51",
};
const STRANGER: Address = "0xc303B5650E3b72Ede0247f81b9aff99eBb63fC1B";
const HASH: Hex = `0x${"ab".repeat(32)}`;

function attempt(over: Partial<Attempt>): Attempt {
  return {
    vault: known.classic,
    kind: "refused",
    caller: known.deployer,
    to: STRANGER,
    amount: 10n ** 16n,
    nonce: 0n,
    refusal: "NotAuthorized",
    keyholder: false,
    blockNumber: 100n,
    txHash: HASH,
    logIndex: 0,
    ...over,
  };
}

describe("pageRanges", () => {
  it("splits a span into RPC-sized pages, inclusive at both ends", () => {
    assert.deepEqual(pageRanges(0n, 25n, 10n), [[0n, 9n], [10n, 19n], [20n, 25n]]);
    assert.deepEqual(pageRanges(5n, 5n, 10n), [[5n, 5n]]);
    assert.deepEqual(pageRanges(10n, 5n, 10n), []);
  });
});

describe("intruderFile", () => {
  it("groups attempts by the wallet the money was meant for", () => {
    const file = intruderFile(
      [
        attempt({ blockNumber: 3n, kind: "paid", refusal: "None", keyholder: true, amount: 10n ** 16n }),
        attempt({ blockNumber: 1n, refusal: "Expired" }),
        attempt({ blockNumber: 2n, refusal: "NotAuthorized", caller: known.owner, keyholder: true, vault: known.hybrid }),
      ],
      known,
    );
    assert.equal(file.intruders.length, 1);
    const [thief] = file.intruders;
    assert.equal(thief!.address, STRANGER);
    assert.equal(thief!.label, null);
    assert.equal(thief!.refused, 2);
    assert.equal(thief!.robbed, 1);
    assert.equal(thief!.withPublishedKey, 2);
    assert.equal(thief!.wantedWei, 2n * 10n ** 16n);
    assert.equal(thief!.tookWei, 10n ** 16n);
    assert.equal(thief!.firstBlock, 1n);
    assert.equal(thief!.lastBlock, 3n);
    assert.deepEqual(thief!.methods, { Expired: 1, NotAuthorized: 1, Robbed: 1 });
    assert.equal(thief!.loot.length, 1);
    assert.deepEqual(thief!.callers, [known.deployer, known.owner]);
  });

  it("does not count the owner's own two-lock withdrawals or bait clean-outs as thefts", () => {
    const file = intruderFile(
      [
        attempt({ vault: known.hybrid, kind: "paid", refusal: "None", keyholder: true, to: known.owner, caller: known.deployer }),
        attempt({ vault: known.classic, kind: "paid", refusal: "None", keyholder: true, to: known.owner, caller: known.owner }),
        attempt({ vault: known.hybrid, refusal: "WrongNonce", to: known.owner, caller: known.owner }),
      ],
      known,
    );
    assert.equal(file.ownerWithdrawals, 1);
    assert.equal(file.ownerCleanouts, 1);
    assert.deepEqual(file.intruders, []);
  });

  it("names the project's own accounts and orders strangers by latest activity", () => {
    const file = intruderFile(
      [
        attempt({ blockNumber: 5n, to: known.deployer }),
        attempt({ blockNumber: 9n, to: STRANGER }),
        attempt({ blockNumber: 7n, to: known.deployer }),
      ],
      known,
    );
    assert.deepEqual(
      file.intruders.map((i) => [i.address, i.label, i.lastBlock]),
      [
        [STRANGER, null, 9n],
        [known.deployer, "the project's own test account", 7n],
      ],
    );
  });

  it("uses the sender as fingerprint when the money was pointed at the owner", () => {
    const a = attempt({ to: known.owner, caller: STRANGER });
    assert.equal(fingerprint(a, known), STRANGER);
    assert.equal(fingerprint(attempt({}), known), STRANGER);
    assert.equal(labelFor(known.hybrid, known), "the two-lock vault");
    assert.equal(labelFor(known.classic.toLowerCase() as Address, known), "the one-lock vault");
    assert.equal(labelFor(STRANGER, known), null);
  });
});

describe("attempt storage form", () => {
  it("round-trips through JSON", () => {
    const a = attempt({ amount: 123456789012345678901234567890n, nonce: 7n, blockNumber: 10065967n });
    const json = JSON.parse(JSON.stringify(attemptToJson(a)));
    assert.deepEqual(attemptFromJson(json), a);
  });

  it("sorts oldest first, then by log index", () => {
    const sorted = sortAttempts([attempt({ blockNumber: 2n, logIndex: 1 }), attempt({ blockNumber: 2n, logIndex: 0 }), attempt({ blockNumber: 1n, logIndex: 5 })]);
    assert.deepEqual(
      sorted.map((a) => [a.blockNumber, a.logIndex]),
      [
        [1n, 5],
        [2n, 0],
        [2n, 1],
      ],
    );
  });
});
