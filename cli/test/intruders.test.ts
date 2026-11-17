import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Intruder } from "@stv/core/history";
import { formatIntruders, type IntruderReport } from "../src/format";

const STRANGER = "0xc303B5650E3b72Ede0247f81b9aff99eBb63fC1B" as const;

const thief: Intruder = {
  address: STRANGER,
  label: null,
  attempts: [],
  refused: 2,
  robbed: 1,
  withPublishedKey: 2,
  wantedWei: 2n * 10n ** 16n,
  tookWei: 10n ** 16n,
  firstBlock: 10n,
  lastBlock: 20n,
  methods: { NotAuthorized: 2, Robbed: 1 },
  loot: [],
  callers: ["0x965cc64A84Cf6E0D7089B72Ba918d7336b5900F0"],
};

const report: IntruderReport = {
  block: 100n,
  file: { intruders: [thief, { ...thief, address: "0x965cc64A84Cf6E0D7089B72Ba918d7336b5900F0", label: "the project's own test account", robbed: 0, tookWei: 0n, methods: { Expired: 1 } }], ownerWithdrawals: 3, ownerCleanouts: 1 },
  trails: {
    [STRANGER.toLowerCase()]: {
      wallet: "qor1thief",
      funding: { from: "qor1classic", uqor: 10000n, hash: "h1", height: 10n, time: "" },
      hops: [{ from: "qor1thief", to: "qor1fence", uqor: 7000n, hash: "h2", height: 15n, time: "" }],
      holdsUqor: 7000n,
      endsAt: "qor1fence",
      cut: false,
    },
  },
  knownNative: { qor1classic: "the one-lock vault" },
};

describe("formatIntruders", () => {
  const text = formatIntruders(report);

  it("names strangers and project accounts and keeps owner activity out of the thefts", () => {
    assert.match(text, /2 wallets came for the money, 1 of them stranger\./);
    assert.match(text, /withdrew from the two-lock vault 3 times and took bait money back 1 time/);
    assert.match(text, new RegExp(`1[.] ${STRANGER}  a stranger`));
    assert.match(text, /2\. 0x965c.*the project's own test account/);
  });

  it("shows methods, what was wanted and what was taken", () => {
    assert.match(text, /methods\s+NotAuthorized x2, Robbed x1/);
    assert.match(text, /wanted\s+0\.02 QOR in 2 refused attempts/);
    assert.match(text, /took\s+0\.01 QOR from the one-lock vault in 1 robbery/);
    assert.match(text, /took\s+nothing/);
  });

  it("follows the money in plain words and says when no trail was read", () => {
    assert.match(text, /first coins came from\s+qor1classic \(the one-lock vault\), 0\.01 QOR at block 10/);
    assert.match(text, /then paid\s+0\.007 QOR to qor1fence \(a stranger\) at block 15/);
    assert.match(text, /trail ends at\s+qor1fence, which holds 0\.007 QOR now/);
    assert.match(text, /money trail\s+not followed: this is one of the project's own accounts/);
    assert.match(text, /wallets, not people/);
  });
});
