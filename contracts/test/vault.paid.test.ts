/** The legitimate path: the real owner, holding both keys, can always get paid. */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Refusal } from "@stv/core";
import { QOR, deployWorld, intentFor, ownerSigns, withdraw, type World } from "./harness/fixture";

describe("vault: authorised withdrawals", () => {
  let w: World;
  beforeEach(async () => {
    w = await deployWorld();
  });

  it("hybrid vault pays when both keys signed, submitted by a stranger", async () => {
    const intent = await intentFor(w, w.hybrid, { amount: 3n * QOR });
    const signed = await ownerSigns(w, w.hybrid, intent);

    const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);

    assert.equal(tx.status, "success");
    assert.equal(tx.result, Refusal.None);
    assert.equal(await w.chain.balance(w.recipient), 3n * QOR);
    assert.equal(await w.chain.balance(w.hybrid.address), 7n * QOR);
    assert.equal(await w.hybrid.read("nonce", []), 1n);
    assert.deepEqual(
      tx.logs.map((l) => l.eventName),
      ["Paid"],
    );
    assert.deepEqual(tx.logs[0]!.args, { to: w.recipient, amount: 3n * QOR, nonce: 0n, caller: w.stranger.address });
  });

  it("hybrid vault pays the owner account with the post-quantum signature alone", async () => {
    // The transaction itself carries the owner's secp256k1 signature.
    const intent = await intentFor(w, w.hybrid);
    const signed = await ownerSigns(w, w.hybrid, intent);

    const tx = await withdraw(w.hybrid, w.owner, intent, "0x", signed.postQuantumSignature);

    assert.equal(tx.result, Refusal.None);
    assert.equal(await w.chain.balance(w.recipient), QOR);
  });

  it("consecutive withdrawals use consecutive nonces", async () => {
    for (let n = 0n; n < 3n; n++) {
      const intent = await intentFor(w, w.hybrid);
      assert.equal(intent.nonce, n);
      const signed = await ownerSigns(w, w.hybrid, intent);
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(tx.result, Refusal.None);
    }
    assert.equal(await w.chain.balance(w.recipient), 3n * QOR);
    const stats = await w.hybrid.read("stats", []);
    assert.equal(stats.paidCount, 3n);
    assert.equal(stats.paidTotal, 3n * QOR);
    assert.equal(stats.refusedCount, 0n);
  });

  it("can pay out the whole balance", async () => {
    const intent = await intentFor(w, w.hybrid, { amount: 10n * QOR });
    const signed = await ownerSigns(w, w.hybrid, intent);
    const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(tx.result, Refusal.None);
    assert.equal(await w.chain.balance(w.hybrid.address), 0n);
  });

  it("a copy of a valid withdrawal sent first causes the same payment, and the original is then refused", async () => {
    const intent = await intentFor(w, w.hybrid);
    const signed = await ownerSigns(w, w.hybrid, intent);

    const frontRun = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    const original = await withdraw(w.hybrid, w.funder, intent, signed.classicalSignature, signed.postQuantumSignature);

    assert.equal(frontRun.result, Refusal.None);
    assert.equal(original.result, Refusal.WrongNonce);
    assert.equal(await w.chain.balance(w.recipient), QOR, "paid once, to the recipient the owner named");
  });

  it("control vault pays on the classical signature alone", async () => {
    const intent = await intentFor(w, w.classic, { amount: 2n * QOR });
    const signed = await ownerSigns(w, w.classic, intent);

    const tx = await withdraw(w.classic, w.stranger, intent, signed.classicalSignature);

    assert.equal(tx.result, Refusal.None);
    assert.equal(await w.chain.balance(w.recipient), 2n * QOR);
  });

  it("control vault pays the owner account with no signatures at all", async () => {
    const intent = await intentFor(w, w.classic);
    const tx = await withdraw(w.classic, w.owner, intent);
    assert.equal(tx.result, Refusal.None);
  });

  it("the verify precompile runs once for a paid hybrid withdrawal and never for the control", async () => {
    const before = w.chain.verifyCalls;
    const a = await intentFor(w, w.classic);
    await withdraw(w.classic, w.owner, a);
    assert.equal(w.chain.verifyCalls, before);

    const b = await intentFor(w, w.hybrid);
    const signed = await ownerSigns(w, w.hybrid, b);
    await withdraw(w.hybrid, w.stranger, b, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(w.chain.verifyCalls, before + 1);
  });
});
