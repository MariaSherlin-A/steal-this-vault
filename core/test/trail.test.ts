import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TxResponseRaw } from "../src/native";
import { type TxSource, firstFunding, followMoney, outgoing, transfersOf, uqorOf } from "../src/trail";

const FEES = "qor17xpfvakm2amg962yls6f84z3kell8c5lyj5r7l";
const A = "qor1aaaa";
const B = "qor1bbbb";
const C = "qor1cccc";
const D = "qor1dddd";

function tx(hash: string, height: number, moves: [string, string, number, number | null][]): TxResponseRaw {
  return {
    txhash: hash,
    height: String(height),
    timestamp: `2026-11-17T00:00:${String(height % 60).padStart(2, "0")}Z`,
    events: moves.map(([sender, recipient, uqor, msgIndex]) => ({
      type: "transfer",
      attributes: [
        { key: "sender", value: sender },
        { key: "recipient", value: recipient },
        { key: "amount", value: `${uqor}uqor` },
        ...(msgIndex === null ? [] : [{ key: "msg_index", value: String(msgIndex) }]),
      ],
    })),
  };
}

/** A tiny ledger that answers the two queries the trail reader makes. */
function ledger(txs: TxResponseRaw[], balances: Record<string, bigint> = {}): TxSource {
  const by = (pick: "sender" | "recipient", who: string) => txs.filter((t) => transfersOf(t).some((x) => x[pick] === who));
  return {
    async searchTxs(query, options) {
      const m = /^transfer\.(sender|recipient)='([^']+)'$/.exec(query);
      assert.ok(m, `unexpected query ${query}`);
      const hits = by(m[1] as "sender" | "recipient", m[2]!).sort((x, y) => Number(x.height) - Number(y.height));
      if (options?.order === "desc") hits.reverse();
      return hits.slice(0, options?.limit ?? hits.length);
    },
    async balance(address) {
      return balances[address] ?? 0n;
    },
  };
}

describe("transfer decoding", () => {
  it("reads uqor amounts only", () => {
    assert.equal(uqorOf("10000uqor"), 10000n);
    assert.equal(uqorOf(" 5uqor "), 5n);
    assert.equal(uqorOf("5aqor"), null);
    assert.equal(uqorOf("5"), null);
  });

  it("keeps fee transfers but marks them as having no message", () => {
    const t = transfersOf(
      tx("h", 1, [
        [A, FEES, 21, null],
        [A, B, 10000, 0],
      ]),
    );
    assert.deepEqual(t, [
      { sender: A, recipient: FEES, uqor: 21n, msgIndex: null },
      { sender: A, recipient: B, uqor: 10000n, msgIndex: 0 },
    ]);
    assert.deepEqual(transfersOf({ events: [{ type: "message", attributes: [] }] }), []);
  });
});

describe("following the money", () => {
  const src = ledger(
    [
      tx("fund-b", 10, [
        [A, FEES, 1, null],
        [A, B, 10000, 0],
      ]),
      tx("b-pays-c", 20, [
        [B, FEES, 1, null],
        [B, C, 7000, 0],
        [B, D, 100, 1],
      ]),
      tx("c-pays-a", 30, [
        [C, FEES, 1, null],
        [C, A, 6000, 0],
      ]),
    ],
    { [A]: 5000n, [C]: 1000n },
  );

  it("finds who first funded a wallet, skipping the fee leg", async () => {
    assert.deepEqual(await firstFunding(src, B), { from: A, uqor: 10000n, hash: "fund-b", height: 10n, time: "2026-11-17T00:00:10Z" });
    assert.equal(await firstFunding(src, "qor1nobody"), null);
  });

  it("lists payments made, without fees", async () => {
    const hops = await outgoing(src, B);
    assert.deepEqual(
      hops.map((h) => [h.to, h.uqor]),
      [
        [C, 7000n],
        [D, 100n],
      ],
    );
  });

  it("follows the largest payment hop by hop and stops when the money comes back round", async () => {
    const trail = await followMoney(src, B, { sinceHeight: 10n });
    assert.equal(trail.funding?.from, A);
    assert.deepEqual(
      trail.hops.map((h) => [h.from, h.to, h.uqor]),
      [
        [B, C, 7000n],
        [C, A, 6000n],
      ],
    );
    assert.equal(trail.endsAt, A);
    assert.equal(trail.holdsUqor, 5000n);
    assert.equal(trail.cut, false);
  });

  it("ignores payments made before the robbery and reports a cut trail", async () => {
    const quiet = await followMoney(src, B, { sinceHeight: 25n });
    assert.deepEqual(quiet.hops, []);
    assert.equal(quiet.endsAt, B);
    const cut = await followMoney(src, B, { maxHops: 1 });
    assert.equal(cut.hops.length, 1);
    assert.equal(cut.cut, true);
    assert.equal(cut.holdsUqor, 1000n);
  });
});
