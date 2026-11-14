/** Counters, the recent-activity ring, deposits, and failure cases that must leave no trace. */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Refusal, signClassical } from "@stv/core";
import { toFunctionSelector, toHex, zeroAddress } from "viem";
import { artifact } from "./harness/chain";
import {
  QOR,
  deployWorld,
  intentFor,
  ownerSigns,
  ref,
  vaultArtifact,
  withdraw,
  type World,
} from "./harness/fixture";

describe("vault: accounting", () => {
  let w: World;
  beforeEach(async () => {
    w = await deployWorld();
  });

  it("starts empty of history", async () => {
    const s = await w.hybrid.read("stats", []);
    assert.equal(s.balance, 10n * QOR);
    assert.equal(s.nonce, 0n);
    assert.equal(s.paidCount + s.refusedCount + s.keyholderRefusedCount + s.counterfactualThefts, 0n);
    assert.equal(s.counterfactualLoss, 0n);
    assert.ok(s.deployedAt > 0n);
    assert.deepEqual(await w.hybrid.read("recent", []), []);
  });

  it("counts refusals by reason and tells keyholders from strangers", async () => {
    const intent = await intentFor(w, w.hybrid);
    await withdraw(w.hybrid, w.stranger, intent); // NotAuthorized
    await withdraw(w.hybrid, w.stranger, intent); // NotAuthorized
    await withdraw(w.hybrid, w.owner, intent); // PqSignatureMalformed
    await withdraw(w.hybrid, w.owner, intent, "0x", toHex(new Uint8Array(4627))); // PqSignatureInvalid
    await withdraw(w.hybrid, w.owner, { ...intent, nonce: 4n }); // WrongNonce, by the keyholder

    const s = await w.hybrid.read("stats", []);
    assert.equal(s.refusedCount, 5n);
    assert.equal(s.keyholderRefusedCount, 3n);
    assert.equal(s.refusedBy[Refusal.NotAuthorized], 2n);
    assert.equal(s.refusedBy[Refusal.PqSignatureMalformed], 1n);
    assert.equal(s.refusedBy[Refusal.PqSignatureInvalid], 1n);
    assert.equal(s.refusedBy[Refusal.WrongNonce], 1n);
    assert.equal(s.refusedBy[Refusal.None], 0n);
    assert.equal(s.paidCount, 0n);
    assert.ok(s.lastRefusedAt > 0n);
    assert.equal(s.lastPaidAt, 0n);
  });

  it("counterfactual loss: only attempts the classical lock alone would have paid", async () => {
    const intent = await intentFor(w, w.hybrid, { amount: 4n * QOR });
    await withdraw(w.hybrid, w.stranger, intent); // no key at all: not a counterfactual theft
    await withdraw(w.hybrid, w.owner, { ...intent, nonce: 9n }); // stale: a classical vault would refuse it too
    let s = await w.hybrid.read("stats", []);
    assert.equal(s.counterfactualThefts, 0n);
    assert.equal(s.counterfactualLoss, 0n);

    await withdraw(w.hybrid, w.owner, intent); // would have taken 4
    const classical = await signClassical(w.owner.privateKey, ref(w, w.hybrid), intent);
    await withdraw(w.hybrid, w.stranger, intent, classical); // would have taken 4, via a relayer
    await withdraw(w.hybrid, w.owner, await intentFor(w, w.hybrid, { amount: 500n * QOR })); // capped at the balance
    s = await w.hybrid.read("stats", []);
    assert.equal(s.counterfactualThefts, 3n);
    assert.equal(s.counterfactualLoss, 4n * QOR + 4n * QOR + 10n * QOR);
    assert.equal(s.balance, 10n * QOR, "and yet nothing left the vault");
  });

  it("the control vault never records a counterfactual theft: it just pays", async () => {
    await withdraw(w.classic, w.owner, await intentFor(w, w.classic, { amount: 10n * QOR }));
    const s = await w.classic.read("stats", []);
    assert.equal(s.counterfactualThefts, 0n);
    assert.equal(s.paidCount, 1n);
    assert.equal(s.balance, 0n);
  });

  it("recent() lists attempts newest first, including payments", async () => {
    const intent = await intentFor(w, w.hybrid);
    await withdraw(w.hybrid, w.stranger, intent); // 0: NotAuthorized
    await withdraw(w.hybrid, w.owner, intent); // 1: PqSignatureMalformed
    const signed = await ownerSigns(w, w.hybrid, intent);
    await withdraw(w.hybrid, w.funder, intent, signed.classicalSignature, signed.postQuantumSignature); // 2: paid

    const recent = await w.hybrid.read("recent", []);
    assert.equal(recent.length, 3);
    assert.deepEqual(
      recent.map((e) => [e.caller, e.refusal, e.keyholder]),
      [
        [w.funder.address, Refusal.None, true],
        [w.owner.address, Refusal.PqSignatureMalformed, true],
        [w.stranger.address, Refusal.NotAuthorized, false],
      ],
    );
    assert.ok(recent[0]!.blockNumber > recent[1]!.blockNumber && recent[1]!.blockNumber > recent[2]!.blockNumber);
  });

  it("recent() keeps the last 16 once the ring wraps", async () => {
    const intent = await intentFor(w, w.hybrid);
    const total = 21;
    const blocks: bigint[] = [];
    for (let i = 0; i < total; i++) {
      blocks.push(w.chain.currentBlock());
      // Alternate so the entries are distinguishable.
      await withdraw(w.hybrid, i % 2 === 0 ? w.stranger : w.owner, intent);
    }
    const recent = await w.hybrid.read("recent", []);
    assert.equal(recent.length, 16);
    assert.deepEqual(
      recent.map((e) => BigInt(e.blockNumber)),
      blocks.slice(total - 16).reverse(),
    );
    assert.equal(recent[0]!.caller, w.stranger.address, "attempt 20 (even) is newest");
    assert.equal((await w.hybrid.read("stats", [])).refusedCount, BigInt(total));
  });
});

describe("vault: deposits", () => {
  let w: World;
  beforeEach(async () => {
    w = await deployWorld();
  });

  it("anyone but the owner can add QOR", async () => {
    const tx = await w.chain.send({ from: w.stranger, to: w.hybrid.address, value: QOR });
    assert.equal(tx.status, "success");
    assert.deepEqual(tx.logs[0], {
      address: w.hybrid.address,
      eventName: "Deposited",
      args: { from: w.stranger.address, amount: QOR },
    });
    assert.equal(await w.chain.balance(w.hybrid.address), 11n * QOR);
  });

  it("the owner account cannot push its QOR in over the EVM, into either vault", async () => {
    // Otherwise a thief inside a window scoped to the vaults could move the owner's
    // liquid QOR into the control vault and withdraw it from there.
    for (const vault of [w.hybrid, w.classic]) {
      const before = await w.chain.balance(vault.address);
      const tx = await w.chain.send({ from: w.owner, to: vault.address, value: QOR });
      assert.equal(tx.status, "reverted");
      assert.equal(tx.error?.name, "OwnerCannotDeposit");
      assert.equal(await w.chain.balance(vault.address), before);
    }
  });

  it("withdraw is not payable: value sent with it reverts", async () => {
    const intent = await intentFor(w, w.classic);
    const tx = await w.classic.write(
      "withdraw",
      [intent.to, intent.amount, intent.nonce, intent.deadline, "0x", "0x"],
      w.owner,
      { value: QOR },
    );
    assert.equal(tx.status, "reverted");
    assert.equal(await w.chain.balance(w.classic.address), 10n * QOR);
  });
});

describe("vault: failures that must leave no trace", () => {
  let w: World;
  beforeEach(async () => {
    w = await deployWorld();
  });

  it("an authorised withdrawal for more than the balance reverts and keeps the nonce", async () => {
    const intent = await intentFor(w, w.hybrid, { amount: 11n * QOR });
    const signed = await ownerSigns(w, w.hybrid, intent);
    const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(tx.status, "reverted");
    assert.deepEqual(tx.error, { name: "InsufficientBalance", args: [11n * QOR, 10n * QOR] });
    assert.equal(await w.hybrid.read("nonce", []), 0n);
    assert.equal((await w.hybrid.read("stats", [])).paidCount, 0n);
  });

  it("a recipient that refuses payment reverts the withdrawal and keeps the nonce", async () => {
    const rejecting = await w.chain.deploy(artifact("RejectingReceiver"), [], w.funder);
    const intent = await intentFor(w, w.hybrid, { to: rejecting.address });
    const signed = await ownerSigns(w, w.hybrid, intent);
    const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(tx.status, "reverted");
    assert.equal(tx.error?.name, "TransferFailed");
    assert.equal(await w.hybrid.read("nonce", []), 0n);
    assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
  });

  it("a recipient that re-enters with the same withdrawal is paid once", async () => {
    const receiver = await w.chain.deploy(artifact("ReentrantReceiver"), [w.hybrid.address], w.funder);
    const intent = await intentFor(w, w.hybrid, { to: receiver.address, amount: 2n * QOR });
    const signed = await ownerSigns(w, w.hybrid, intent);
    await w.chain.send({
      from: w.stranger,
      to: receiver.address,
      data: receiver.encode("arm", [signed.calldata, true]),
    });

    const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);

    assert.equal(tx.result, Refusal.None);
    assert.equal(await receiver.read("reentered", []), true, "it did call back in");
    assert.equal(
      await receiver.read("innerError", []),
      toFunctionSelector("ReentrancyGuardReentrantCall()"),
      "and the guard is what stopped the inner call",
    );
    assert.equal(await w.chain.balance(receiver.address), 2n * QOR, "paid once, not twice");
    assert.equal(await w.chain.balance(w.hybrid.address), 8n * QOR);
    assert.equal(await w.hybrid.read("nonce", []), 1n);
  });

  it("if the re-entering recipient lets the inner failure escape, the whole withdrawal reverts", async () => {
    const receiver = await w.chain.deploy(artifact("ReentrantReceiver"), [w.hybrid.address], w.funder);
    const intent = await intentFor(w, w.hybrid, { to: receiver.address });
    const signed = await ownerSigns(w, w.hybrid, intent);
    await w.chain.send({
      from: w.stranger,
      to: receiver.address,
      data: receiver.encode("arm", [signed.calldata, false]),
    });

    const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);

    assert.equal(tx.status, "reverted");
    assert.equal(tx.error?.name, "TransferFailed");
    assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
    assert.equal(await w.hybrid.read("nonce", []), 0n);
  });

  it("cannot be deployed without an owner", async () => {
    await assert.rejects(w.chain.deploy(vaultArtifact(), [zeroAddress, true], w.funder), /ZeroOwner/);
  });
});
