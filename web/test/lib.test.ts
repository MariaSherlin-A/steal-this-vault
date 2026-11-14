import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { explain, modeLabel, recordsLeft, tally } from "../src/lib/explain";
import { blocksAgo, blocksToDuration, plural, qor, short, uqorToQor } from "../src/lib/format";
import { MSG_SEND_TYPE_URL, encodeMsgSend } from "../src/lib/msgSend";

const FROM = "qor15tjx4hk6m4ck8dqh3wc84gyxwe09thtnfj6z7w";
const TO = "qor1saa6yuwhhh7m0haqhdvx860m7pygt3yrq820ts";

describe("encodeMsgSend", () => {
  for (const uqor of [1n, 100_000n, 500_000n, 1_000_000n, 123_456_789_012n]) {
    it(`matches the SDK encoder byte for byte (${uqor} uqor)`, () => {
      const expected = MsgSend.encode(
        MsgSend.fromPartial({ fromAddress: FROM, toAddress: TO, amount: [{ denom: "uqor", amount: uqor.toString() }] }),
      ).finish();
      assert.deepEqual(Array.from(encodeMsgSend(FROM, TO, uqor)), Array.from(expected));
    });
  }

  it("round-trips through the SDK decoder", () => {
    const decoded = MsgSend.decode(encodeMsgSend(FROM, TO, 250_000n));
    assert.equal(decoded.fromAddress, FROM);
    assert.equal(decoded.toAddress, TO);
    assert.deepEqual(decoded.amount, [{ denom: "uqor", amount: "250000" }]);
  });

  it("uses the bank module's type URL", () => {
    assert.equal(MSG_SEND_TYPE_URL, MsgSend.typeUrl);
  });
});

describe("explain", () => {
  const refusedBy = (by: "chain" | "vault", code?: string) => ({ verdict: "refused", by, code, mode: "broadcast" }) as const;

  it("reports a chain refusal for a missing second signature", () => {
    const told = explain(refusedBy("chain", "pqc 20"), { expects: "refused" });
    assert.equal(told.tone, "held");
    assert.equal(told.who, "Refused by the chain");
    assert.match(told.plain, /second signature/);
  });

  it("has plain words for every chain reason the runner can return", () => {
    for (const code of ["no-window", "target-not-allowed", "window-scope", "window-exhausted", "no-pqc-key", "delegation-consent", "nonce", "funds"]) {
      const told = explain(refusedBy("chain", code), { expects: "refused" });
      assert.notEqual(told.plain, "The chain turned it away.", code);
    }
    assert.equal(explain(refusedBy("chain", "something-new"), { expects: "refused" }).plain, "The chain turned it away.");
  });

  it("uses the vault's own refusal text", () => {
    const told = explain(refusedBy("vault", "PqSignatureInvalid"), { expects: "refused" });
    assert.equal(told.who, "Refused by the vault");
    assert.equal(told.plain, "The ordinary key fits. The second key is a fake.");
  });

  it("calls the control vault robbed only when it really paid", () => {
    const paid = explain({ verdict: "succeeded", mode: "on-chain" }, { expects: "paid" });
    const wouldPay = explain({ verdict: "succeeded", mode: "simulated" }, { expects: "paid" });
    assert.equal(paid.tone, "robbed");
    assert.equal(paid.stamp, "Robbed");
    assert.equal(wouldPay.tone, "robbed");
    assert.equal(wouldPay.stamp, "Would pay");
  });

  it("raises the alarm when a theft that should fail succeeds", () => {
    assert.equal(explain({ verdict: "succeeded", mode: "on-chain" }, { expects: "refused" }).tone, "alarm");
  });

  it("marks skipped attempts as not run", () => {
    assert.equal(explain({ verdict: "skipped", mode: "simulated" }, { expects: "refused" }).tone, "skipped");
  });

  it("never describes a simulated check as recorded", () => {
    assert.match(modeLabel("simulated").short, /not recorded/);
    assert.match(modeLabel("on-chain").short, /Recorded/);
  });
});

describe("tally and recordsLeft", () => {
  it("counts each tone", () => {
    assert.deepEqual(tally(["held", "held", "robbed", "skipped", "alarm"]), { total: 5, held: 2, robbed: 1, skipped: 1, alarms: 1 });
  });

  it("is zero when the window is closed or unknown", () => {
    assert.equal(recordsLeft(null), 0);
    assert.equal(recordsLeft({ open: false, remainingTxs: 400n, remainingValueUqor: 500_000n }), 0);
  });

  it("is limited by whichever runs out first: fees or transactions", () => {
    assert.equal(recordsLeft({ open: true, remainingTxs: 400n, remainingValueUqor: 500_000n }), 11);
    assert.equal(recordsLeft({ open: true, remainingTxs: 3n, remainingValueUqor: 500_000n }), 3);
  });
});

describe("format", () => {
  it("prints QOR without trailing zeros", () => {
    assert.equal(qor(9_999_000_000_000_000_000n), "9.999");
    assert.equal(qor(10n ** 18n), "1");
    assert.equal(qor(123_456_789_000_000_000n), "0.1234");
    assert.equal(uqorToQor(325_833n), "0.325");
    assert.equal(uqorToQor(1_000_000n), "1");
  });

  it("shortens addresses and leaves short strings alone", () => {
    assert.equal(short("0xA2E46aDeDADD7163b4178Bb07AA086765e55dd73"), "0xA2E4…dd73");
    assert.equal(short("0x1234"), "0x1234");
  });

  it("turns blocks into rough durations", () => {
    assert.equal(blocksToDuration(10n), "14 s");
    assert.equal(blocksToDuration(600n), "14 min");
    assert.equal(blocksToDuration(10_000n), "3.9 h");
    assert.equal(blocksAgo(0n, 100n), "never");
    assert.equal(blocksAgo(90n, 100n), "14 s ago");
    assert.equal(blocksAgo(200n, 100n), "0 s ago");
  });

  it("pluralises", () => {
    assert.equal(plural(1n, "time"), "1 time");
    assert.equal(plural(5, "attempt"), "5 attempts");
    assert.equal(plural(2n, "was", "were"), "2 were");
  });
});
