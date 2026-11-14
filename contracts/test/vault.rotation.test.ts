/**
 * The vault reads the owner's post-quantum key from the chain on every call,
 * so rotating the key on the native lane changes the vault's lock at once.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Refusal, signClassical, signPostQuantum } from "@stv/core";
import { bytesToHex } from "viem";
import { deployWorld, intentFor, ownerSigns, pqKeypair, ref, withdraw, type World } from "./harness/fixture";

describe("vault: key rotation", () => {
  let w: World;
  beforeEach(async () => {
    w = await deployWorld();
  });

  it("ownerKey() reports the key on record", async () => {
    const [usable, registered, possessionProven, algorithmId, publicKey] = await w.hybrid.read("ownerKey", []);
    assert.deepEqual([usable, registered, possessionProven, algorithmId], [true, true, true, 1]);
    assert.equal(publicKey, bytesToHex(w.ownerPq.publicKey));
  });

  it("after a rotation the old key stops working and the new key works, with no change to the vault", async () => {
    const rotated = pqKeypair(0x99);
    const intent = await intentFor(w, w.hybrid);
    const classical = await signClassical(w.owner.privateKey, ref(w, w.hybrid), intent);
    const withOldKey = signPostQuantum(w.ownerPq.secretKey, ref(w, w.hybrid), intent);
    const withNewKey = signPostQuantum(rotated.secretKey, ref(w, w.hybrid), intent);

    const early = await withdraw(w.hybrid, w.stranger, intent, classical, withNewKey);
    assert.equal(early.result, Refusal.PqSignatureInvalid, "the new key means nothing before it is on record");

    w.chain.registerKey(w.owner.address, rotated.publicKey);

    const stale = await withdraw(w.hybrid, w.stranger, intent, classical, withOldKey);
    assert.equal(stale.result, Refusal.PqSignatureInvalid, "an intent signed before the rotation is dead");

    const fresh = await withdraw(w.hybrid, w.stranger, intent, classical, withNewKey);
    assert.equal(fresh.result, Refusal.None);

    const [usable, , , , publicKey] = await w.hybrid.read("ownerKey", []);
    assert.equal(usable, true);
    assert.equal(publicKey, bytesToHex(rotated.publicKey));
  });

  it("a rotation without proof of possession locks the vault until a proven key is on record", async () => {
    const intent = await intentFor(w, w.hybrid);
    const signed = await ownerSigns(w, w.hybrid, intent);

    w.chain.registerKey(w.owner.address, w.ownerPq.publicKey, { possessionProven: false });
    const locked = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(locked.result, Refusal.PqKeyUnavailable);

    w.chain.registerKey(w.owner.address, w.ownerPq.publicKey, { possessionProven: true });
    const open = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    assert.equal(open.result, Refusal.None);
  });
});
