/**
 * The experiment the project is built around.
 *
 * Two vaults, same code, same owner, same balance. The owner's secp256k1 key
 * is public. The only difference is the `postQuantum` flag.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { Refusal, encodeWithdraw, signClassical } from "@stv/core";
import { QOR, deployWorld, intentFor, judge, ref, vaultArtifact, withdraw, type World } from "./harness/fixture";

describe("the experiment: one published key, two vaults", () => {
  let w: World;
  /** The thief holds the owner's secp256k1 private key and nothing else. */
  const thiefWallet = "0x000000000000000000000000000000000000dEaD" as const;

  before(async () => {
    w = await deployWorld();
  });

  it("both vaults run the same code", () => {
    // One artifact, deployed twice. Only the constructor argument differs.
    assert.equal(w.hybrid.abi, w.classic.abi);
    assert.ok(vaultArtifact().bytecode.length > 2);
  });

  it("control: the thief empties the classical vault, through a relayer", async () => {
    const intent = await intentFor(w, w.classic, { to: thiefWallet, amount: 10n * QOR });
    const stolenKeySignature = await signClassical(w.owner.privateKey, ref(w, w.classic), intent);

    const tx = await withdraw(w.classic, w.stranger, intent, stolenKeySignature);

    assert.equal(tx.result, Refusal.None);
    assert.equal(await w.chain.balance(w.classic.address), 0n);
    assert.equal(await w.chain.balance(thiefWallet), 10n * QOR);
  });

  it("treatment: the same move against the hybrid vault takes nothing", async () => {
    const intent = await intentFor(w, w.hybrid, { to: thiefWallet, amount: 10n * QOR });
    const stolenKeySignature = await signClassical(w.owner.privateKey, ref(w, w.hybrid), intent);

    const viaRelayer = await withdraw(w.hybrid, w.stranger, intent, stolenKeySignature);
    const asOwnerAccount = await withdraw(w.hybrid, w.owner, intent);

    assert.equal(viaRelayer.result, Refusal.PqSignatureMalformed);
    assert.equal(asOwnerAccount.result, Refusal.PqSignatureMalformed);
    assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
    assert.equal(await w.chain.balance(thiefWallet), 10n * QOR, "only the control vault's money");
  });

  it("the hybrid vault's own ledger says what would have happened", async () => {
    const s = await w.hybrid.read("stats", []);
    assert.equal(s.counterfactualThefts, 2n);
    assert.equal(s.counterfactualLoss, 20n * QOR);
    assert.equal(s.paidCount, 0n);
    const c = await w.classic.read("stats", []);
    assert.equal(c.paidCount, 1n);
    assert.equal(c.paidTotal, 10n * QOR);
  });

  it("the exact call data that robbed the control is refused by the hybrid vault", async () => {
    // Refill the control and rob it again, keeping the transaction's call data.
    await w.chain.send({ from: w.funder, to: w.classic.address, value: QOR });
    const intent = await intentFor(w, w.classic, { to: thiefWallet, amount: QOR });
    const sig = await signClassical(w.owner.privateKey, ref(w, w.classic), intent);
    const calldata = encodeWithdraw(intent, sig);
    const robbed = await w.chain.send({ from: w.stranger, to: w.classic.address, data: calldata });
    assert.equal(robbed.status, "success");
    assert.equal(await w.chain.balance(w.classic.address), 0n);

    const before = await w.chain.balance(w.hybrid.address);
    const replayed = await w.chain.send({ from: w.stranger, to: w.hybrid.address, data: calldata });
    assert.equal(replayed.status, "success");
    assert.equal(replayed.logs[0]!.eventName, "Refused");
    assert.equal(await w.chain.balance(w.hybrid.address), before);
  });

  it("a view call tells the thief the answer before they spend any gas", async () => {
    const intent = await intentFor(w, w.hybrid, { to: thiefWallet });
    assert.deepEqual(await judge(w.hybrid, w.owner.address, intent), {
      refusal: Refusal.PqSignatureMalformed,
      keyholder: true,
    });
  });
});
