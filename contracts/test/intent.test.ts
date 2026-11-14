/**
 * The TypeScript intent library and the Solidity contracts must build exactly
 * the same bytes, or signatures made off chain would not verify on chain.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  PQ_DOMAIN_TAG,
  WITHDRAW_TYPEHASH,
  withdrawDigest,
  withdrawIntentBytes,
  withdrawSignBytes,
  type WithdrawIntent,
} from "@stv/core";
import { bytesToHex, hexToString } from "viem";
import { deployWorld, ref, type World } from "./harness/fixture";

describe("intent encoding: TypeScript and Solidity agree", () => {
  let world: World;
  const intents: WithdrawIntent[] = [
    { to: "0x00000000000000000000000000000000000B0b01", amount: 1n, nonce: 0n, deadline: 1_900_000_000n },
    { to: "0xffffffffffffffffffffffffffffffffffffffff", amount: 2n ** 256n - 1n, nonce: 2n ** 64n, deadline: 2n ** 255n },
    { to: "0x0000000000000000000000000000000000000000", amount: 0n, nonce: 7n, deadline: 0n },
  ];

  before(async () => {
    world = await deployWorld();
  });

  it("type hash", async () => {
    assert.equal(await world.hybrid.read("WITHDRAW_TYPEHASH", []), WITHDRAW_TYPEHASH);
  });

  it("post-quantum domain tag", async () => {
    const onChain = await world.hybrid.read("PQ_DOMAIN_TAG", []);
    assert.equal(hexToString(onChain), PQ_DOMAIN_TAG);
    assert.equal(onChain.slice(0, 4), "0x19", "starts with 0x19, which no chain sign-bytes format does");
  });

  it("intent bytes", async () => {
    for (const i of intents) {
      assert.equal(await world.hybrid.read("withdrawIntent", [i.to, i.amount, i.nonce, i.deadline]), withdrawIntentBytes(i));
    }
  });

  it("EIP-712 digest, for both vaults", async () => {
    for (const vault of [world.hybrid, world.classic]) {
      for (const i of intents) {
        assert.equal(
          await vault.read("withdrawDigest", [i.to, i.amount, i.nonce, i.deadline]),
          withdrawDigest(ref(world, vault), i),
        );
      }
    }
  });

  it("post-quantum sign-bytes, for both vaults", async () => {
    for (const vault of [world.hybrid, world.classic]) {
      for (const i of intents) {
        assert.equal(
          await vault.read("withdrawSignBytes", [i.to, i.amount, i.nonce, i.deadline]),
          bytesToHex(withdrawSignBytes(ref(world, vault), i)),
        );
      }
    }
  });

  it("the digest and the sign-bytes differ between the two vaults", async () => {
    const i = intents[0]!;
    assert.notEqual(withdrawDigest(ref(world, world.hybrid), i), withdrawDigest(ref(world, world.classic), i));
    assert.notEqual(
      bytesToHex(withdrawSignBytes(ref(world, world.hybrid), i)),
      bytesToHex(withdrawSignBytes(ref(world, world.classic), i)),
    );
  });
});
