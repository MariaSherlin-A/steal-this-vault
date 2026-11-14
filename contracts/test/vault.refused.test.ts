/**
 * Every way a withdrawal can be refused. Each test also checks that nothing was
 * paid and that the refusal was recorded instead of reverted.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { mldsa87 } from "@qorechain/pqc";
import {
  Refusal,
  signClassical,
  signPostQuantum,
  withdrawDigest,
  withdrawIntentBytes,
  type RefusalCode,
} from "@stv/core";
import { bytesToHex, hexToBytes, recoverAddress, toHex, type Hex } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import {
  QOR,
  deployWorld,
  intentFor,
  judge,
  ownerSigns,
  pqKeypair,
  ref,
  vaultArtifact,
  withdraw,
  type World,
} from "./harness/fixture";

/** Assert a refusal was recorded, with the expected reason, and that no money moved. */
async function expectRefused(
  w: World,
  tx: Awaited<ReturnType<typeof withdraw>>,
  reason: RefusalCode,
  keyholder: boolean,
  vault = w.hybrid,
) {
  assert.equal(tx.status, "success", "a refusal is recorded, not reverted");
  assert.equal(tx.result, reason);
  assert.deepEqual(
    tx.logs.map((l) => l.eventName),
    ["Refused"],
  );
  assert.equal(tx.logs[0]!.args.reason, reason);
  assert.equal(tx.logs[0]!.args.keyholder, keyholder);
  assert.equal(await w.chain.balance(vault.address), 10n * QOR, "vault balance unchanged");
  assert.equal(await w.chain.balance(w.recipient), 0n, "recipient received nothing");
  assert.equal(await vault.read("nonce", []), 0n, "nonce unchanged");
}

const flipBit = (hex: Hex, byteIndex: number): Hex => {
  const bytes = hexToBytes(hex);
  bytes[byteIndex] = bytes[byteIndex]! ^ 0x01;
  return bytesToHex(bytes);
};

describe("vault: refusals", () => {
  let w: World;
  beforeEach(async () => {
    w = await deployWorld();
  });

  describe("deadline", () => {
    it("Expired: a fully signed intent after its deadline", async () => {
      const intent = await intentFor(w, w.hybrid, { deadline: w.chain.now() + 10n });
      const signed = await ownerSigns(w, w.hybrid, intent);
      w.chain.warp(11);
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      await expectRefused(w, tx, Refusal.Expired, true);
    });

    it("an intent is still valid in the last second of its deadline", async () => {
      const intent = await intentFor(w, w.hybrid, { deadline: w.chain.now() });
      const signed = await ownerSigns(w, w.hybrid, intent);
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(tx.result, Refusal.None);
    });
  });

  describe("nonce", () => {
    it("WrongNonce: replaying a withdrawal that was already paid", async () => {
      const intent = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, intent);
      const first = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(first.result, Refusal.None);

      const replay = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(replay.result, Refusal.WrongNonce);
      assert.equal(replay.logs[0]!.args.keyholder, true, "the signatures are the owner's real ones");
      assert.equal(await w.chain.balance(w.recipient), QOR, "paid once only");
      assert.equal(await w.hybrid.read("nonce", []), 1n);
    });

    it("WrongNonce: an intent signed for a future nonce", async () => {
      const intent = await intentFor(w, w.hybrid, { nonce: 5n });
      const signed = await ownerSigns(w, w.hybrid, intent);
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      await expectRefused(w, tx, Refusal.WrongNonce, true);
    });

    it("a refused attempt does not use up the owner's nonce", async () => {
      const intent = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, intent);
      for (let i = 0; i < 3; i++) await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature);
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(tx.result, Refusal.None, "the owner's intent still works after the failed attempts");
    });
  });

  describe("classical layer", () => {
    it("NotAuthorized: a stranger with no signatures", async () => {
      const tx = await withdraw(w.hybrid, w.stranger, await intentFor(w, w.hybrid));
      await expectRefused(w, tx, Refusal.NotAuthorized, false);
    });

    it("NotAuthorized: signed by a different secp256k1 key", async () => {
      const intent = await intentFor(w, w.hybrid);
      const sig = await signClassical(w.stranger.privateKey, ref(w, w.hybrid), intent);
      const tx = await withdraw(w.hybrid, w.stranger, intent, sig);
      await expectRefused(w, tx, Refusal.NotAuthorized, false);
    });

    it("NotAuthorized: the owner's signature moved onto a different recipient or amount", async () => {
      const signedFor = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, signedFor);
      for (const tampered of [
        { ...signedFor, to: w.stranger.address },
        { ...signedFor, amount: 9n * QOR },
        { ...signedFor, deadline: signedFor.deadline + 1n },
      ]) {
        const tx = await withdraw(w.hybrid, w.stranger, tampered, signed.classicalSignature, signed.postQuantumSignature);
        assert.equal(tx.result, Refusal.NotAuthorized);
      }
      assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
    });

    it("NotAuthorized: malformed classical signatures", async () => {
      const intent = await intentFor(w, w.hybrid);
      const good = await signClassical(w.owner.privateKey, ref(w, w.hybrid), intent);
      const malformed: Hex[] = ["0x", "0x00", good.slice(0, 130) as Hex, `${good}00`, flipBit(good, 10)];
      for (const bad of malformed) {
        const tx = await withdraw(w.hybrid, w.stranger, intent, bad);
        assert.equal(tx.result, Refusal.NotAuthorized, `signature ${bad.slice(0, 12)}...`);
      }
    });

    it("NotAuthorized: the malleable twin of a valid signature (high s)", async () => {
      // (r, n - s, v flipped) verifies under plain ecrecover. The vault rejects it.
      const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
      const intent = await intentFor(w, w.hybrid);
      const { r, s, yParity } = await sign({
        hash: withdrawDigest(ref(w, w.hybrid), intent),
        privateKey: w.owner.privateKey,
      });
      const twin = `${r}${(N - BigInt(s)).toString(16).padStart(64, "0")}${yParity === 0 ? "1c" : "1b"}` as Hex;
      const digest = withdrawDigest(ref(w, w.hybrid), intent);
      assert.equal(
        await recoverAddress({ hash: digest, signature: twin }),
        w.owner.address,
        "the twin does recover to the owner under plain ecrecover",
      );
      const tx = await withdraw(w.hybrid, w.stranger, intent, twin);
      await expectRefused(w, tx, Refusal.NotAuthorized, false);
    });

    it("NotAuthorized applies to the control vault too", async () => {
      const tx = await withdraw(w.classic, w.stranger, await intentFor(w, w.classic));
      await expectRefused(w, tx, Refusal.NotAuthorized, false, w.classic);
    });
  });

  describe("post-quantum layer: the secp256k1 key is in the thief's hands", () => {
    it("PqSignatureMalformed: the owner account calls with no post-quantum signature", async () => {
      const tx = await withdraw(w.hybrid, w.owner, await intentFor(w, w.hybrid));
      await expectRefused(w, tx, Refusal.PqSignatureMalformed, true);
    });

    it("PqSignatureMalformed: a valid classical signature and no post-quantum signature", async () => {
      const intent = await intentFor(w, w.hybrid);
      const sig = await signClassical(w.owner.privateKey, ref(w, w.hybrid), intent);
      const tx = await withdraw(w.hybrid, w.stranger, intent, sig);
      await expectRefused(w, tx, Refusal.PqSignatureMalformed, true);
    });

    it("PqSignatureMalformed: wrong-length signatures never reach the verifier", async () => {
      const intent = await intentFor(w, w.hybrid);
      const good = (await ownerSigns(w, w.hybrid, intent)).postQuantumSignature;
      const calls = w.chain.verifyCalls;
      for (const bad of [good.slice(0, -2) as Hex, `${good}00` as Hex, toHex(new Uint8Array(65)), toHex(new Uint8Array(2420))]) {
        const tx = await withdraw(w.hybrid, w.owner, intent, "0x", bad);
        assert.equal(tx.result, Refusal.PqSignatureMalformed);
      }
      assert.equal(w.chain.verifyCalls, calls, "no gas spent on verification for a signature of the wrong size");
    });

    it("PqSignatureInvalid: a signature of the right size filled with zeros", async () => {
      const tx = await withdraw(w.hybrid, w.owner, await intentFor(w, w.hybrid), "0x", toHex(new Uint8Array(4627)));
      await expectRefused(w, tx, Refusal.PqSignatureInvalid, true);
    });

    it("PqSignatureInvalid: one flipped bit in the owner's real signature", async () => {
      const intent = await intentFor(w, w.hybrid);
      const good = (await ownerSigns(w, w.hybrid, intent)).postQuantumSignature;
      for (const index of [0, 31, 2000, 4626]) {
        const tx = await withdraw(w.hybrid, w.owner, intent, "0x", flipBit(good, index));
        assert.equal(tx.result, Refusal.PqSignatureInvalid, `bit flipped in byte ${index}`);
      }
      assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
    });

    it("PqSignatureInvalid: signed with the thief's own ML-DSA-87 key", async () => {
      const intent = await intentFor(w, w.hybrid);
      const thiefPq = pqKeypair(0x66);
      const sig = signPostQuantum(thiefPq.secretKey, ref(w, w.hybrid), intent);
      const tx = await withdraw(w.hybrid, w.owner, intent, "0x", sig);
      await expectRefused(w, tx, Refusal.PqSignatureInvalid, true);
    });

    it("PqSignatureInvalid: the thief registers their own key on their own account", async () => {
      // The vault looks up the owner's key, whoever submits.
      const thiefPq = pqKeypair(0x67);
      w.chain.registerKey(w.stranger.address, thiefPq.publicKey);
      const intent = await intentFor(w, w.hybrid);
      const classical = await signClassical(w.owner.privateKey, ref(w, w.hybrid), intent);
      const sig = signPostQuantum(thiefPq.secretKey, ref(w, w.hybrid), intent);
      const tx = await withdraw(w.hybrid, w.stranger, intent, classical, sig);
      await expectRefused(w, tx, Refusal.PqSignatureInvalid, true);
    });

    it("PqSignatureInvalid: the owner's real signature for a different amount, recipient, nonce or deadline", async () => {
      const signedFor = await intentFor(w, w.hybrid);
      const good = (await ownerSigns(w, w.hybrid, signedFor)).postQuantumSignature;
      for (const tampered of [
        { ...signedFor, amount: 10n * QOR },
        { ...signedFor, to: w.stranger.address },
        { ...signedFor, deadline: signedFor.deadline + 1n },
      ]) {
        // Sent by the owner account, so the classical layer passes on its own.
        const tx = await withdraw(w.hybrid, w.owner, tampered, "0x", good);
        assert.equal(tx.result, Refusal.PqSignatureInvalid);
      }
      assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
    });
  });

  describe("domain separation", () => {
    it("a signature for one vault is refused by another vault of the same owner", async () => {
      const other = await w.chain.deploy(vaultArtifact(), [w.owner.address, true], w.funder);
      await w.chain.send({ from: w.funder, to: other.address, value: 10n * QOR });

      const intent = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, intent);

      const viaRelay = await withdraw(other, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(viaRelay.result, Refusal.NotAuthorized, "the EIP-712 domain names the other vault");
      const viaOwner = await withdraw(other, w.owner, intent, "0x", signed.postQuantumSignature);
      assert.equal(viaOwner.result, Refusal.PqSignatureInvalid, "so do the post-quantum sign-bytes");
      assert.equal(await w.chain.balance(other.address), 10n * QOR);
    });

    it("a signature made on another chain is refused", async () => {
      // Same deployer and nonce on a chain with another id: the vault lands at the same address.
      const elsewhere = await deployWorld({ chainId: 9801 });
      assert.equal(elsewhere.hybrid.address, w.hybrid.address);
      const intent = await intentFor(w, w.hybrid);
      const foreign = await ownerSigns(elsewhere, elsewhere.hybrid, intent);

      const viaRelay = await withdraw(w.hybrid, w.stranger, intent, foreign.classicalSignature, foreign.postQuantumSignature);
      assert.equal(viaRelay.result, Refusal.NotAuthorized);
      const viaOwner = await withdraw(w.hybrid, w.owner, intent, "0x", foreign.postQuantumSignature);
      assert.equal(viaOwner.result, Refusal.PqSignatureInvalid);
    });

    it("the owner's ML-DSA-87 signature over other bytes cannot be reused", async () => {
      const intent = await intentFor(w, w.hybrid);
      const vault = ref(w, w.hybrid);
      const sk = w.ownerPq.secretKey;
      const text = (s: string) => new TextEncoder().encode(s);
      const candidates: Record<string, Uint8Array> = {
        // What a contract that signed only a 32-byte digest would accept.
        "the EIP-712 digest": hexToBytes(withdrawDigest(vault, intent)),
        // The intent with no domain tag, chain id, contract or signer in front.
        "the bare intent": hexToBytes(withdrawIntentBytes(intent)),
        // Sign-bytes in the format of a native-lane hybrid transaction. Every hybrid
        // transaction the owner sends publishes a signature like this one.
        "a native transaction's sign-bytes": new Uint8Array([
          ...text("qorechain-pqc-hybrid-v2"),
          ...hexToBytes(withdrawIntentBytes(intent)),
        ]),
        // A proof of possession, published when the key was registered.
        "a proof of possession": new Uint8Array([...text("qorechain-pqc-pop-v1"), ...w.ownerPq.publicKey]),
      };
      for (const [what, bytes] of Object.entries(candidates)) {
        const harvested = toHex(mldsa87.sign(sk, bytes));
        const tx = await withdraw(w.hybrid, w.owner, intent, "0x", harvested);
        assert.equal(tx.result, Refusal.PqSignatureInvalid, `signature over ${what}`);
      }
      assert.equal(await w.chain.balance(w.hybrid.address), 10n * QOR);
    });
  });

  describe("fail closed: the owner's key cannot be read", () => {
    const cases: Record<string, (w: World) => void> = {
      "the owner has no key on record": (w) => w.chain.unregisterKey(w.owner.address),
      "the key was registered without proof of possession": (w) =>
        w.chain.registerKey(w.owner.address, w.ownerPq.publicKey, { possessionProven: false }),
      "the key is of another algorithm": (w) =>
        w.chain.registerKey(w.owner.address, w.ownerPq.publicKey, { algorithmId: 2 }),
      "the key has the wrong length": (w) => w.chain.registerKey(w.owner.address, w.ownerPq.publicKey.slice(0, 1952)),
      "the record says unregistered": (w) =>
        w.chain.registerKey(w.owner.address, w.ownerPq.publicKey, { registered: false }),
      "the key status precompile is not active on this network": (w) => {
        w.chain.precompiles.keyStatus = false;
      },
    };

    for (const [name, breakIt] of Object.entries(cases)) {
      it(`PqKeyUnavailable: ${name}`, async () => {
        const intent = await intentFor(w, w.hybrid);
        const signed = await ownerSigns(w, w.hybrid, intent);
        breakIt(w);
        const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
        await expectRefused(w, tx, Refusal.PqKeyUnavailable, true);
      });
    }

    it("PqSignatureInvalid: the verify precompile is not active, even for the owner's real signature", async () => {
      const intent = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, intent);
      w.chain.precompiles.verify = false;
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      await expectRefused(w, tx, Refusal.PqSignatureInvalid, true);
    });

    it("the vault works again once the precompiles are back", async () => {
      const intent = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, intent);
      w.chain.precompiles.verify = false;
      w.chain.precompiles.keyStatus = false;
      await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      w.chain.precompiles.verify = true;
      w.chain.precompiles.keyStatus = true;
      const tx = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.equal(tx.result, Refusal.None);
    });

    it("a missing precompile does not affect the control vault", async () => {
      w.chain.precompiles.verify = false;
      w.chain.precompiles.keyStatus = false;
      const tx = await withdraw(w.classic, w.owner, await intentFor(w, w.classic));
      assert.equal(tx.result, Refusal.None);
    });
  });

  describe("order of checks", () => {
    it("deadline, then nonce, then classical, then post-quantum", async () => {
      const expired = { ...(await intentFor(w, w.hybrid)), nonce: 9n, deadline: w.chain.now() - 1n };
      assert.equal((await judge(w.hybrid, w.stranger.address, expired)).refusal, Refusal.Expired);

      const wrongNonce = { ...(await intentFor(w, w.hybrid)), nonce: 9n };
      assert.equal((await judge(w.hybrid, w.stranger.address, wrongNonce)).refusal, Refusal.WrongNonce);

      const fresh = await intentFor(w, w.hybrid);
      assert.equal((await judge(w.hybrid, w.stranger.address, fresh)).refusal, Refusal.NotAuthorized);
      assert.equal((await judge(w.hybrid, w.owner.address, fresh)).refusal, Refusal.PqSignatureMalformed);
    });

    it("judge agrees with withdraw and changes nothing", async () => {
      const intent = await intentFor(w, w.hybrid);
      const signed = await ownerSigns(w, w.hybrid, intent);
      const before = await w.hybrid.read("stats", []);

      const verdict = await judge(w.hybrid, w.stranger.address, intent, signed.classicalSignature, signed.postQuantumSignature);
      assert.deepEqual(verdict, { refusal: Refusal.None, keyholder: true });
      const refusedVerdict = await judge(w.hybrid, w.owner.address, intent);
      assert.deepEqual(refusedVerdict, { refusal: Refusal.PqSignatureMalformed, keyholder: true });

      assert.deepEqual(await w.hybrid.read("stats", []), before, "judge is a view");
      assert.equal(await w.chain.balance(w.recipient), 0n);
    });

    it("keyholder is reported even when the intent is stale", async () => {
      const stale = { ...(await intentFor(w, w.hybrid)), nonce: 3n };
      const sig = await signClassical(w.owner.privateKey, ref(w, w.hybrid), stale);
      assert.deepEqual(await judge(w.hybrid, w.stranger.address, stale, sig), {
        refusal: Refusal.WrongNonce,
        keyholder: true,
      });
      assert.deepEqual(await judge(w.hybrid, w.stranger.address, stale), {
        refusal: Refusal.WrongNonce,
        keyholder: false,
      });
    });
  });

  it("the recovered signer of the classical signature really is the owner (sanity)", async () => {
    assert.equal(privateKeyToAccount(w.owner.privateKey).address, w.owner.address);
    assert.equal(await w.hybrid.read("owner", []), w.owner.address);
    assert.equal(await w.hybrid.read("postQuantum", []), true);
    assert.equal(await w.classic.read("postQuantum", []), false);
  });
});
