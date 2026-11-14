/** The reusable guard on a different contract: an account that makes arbitrary calls. */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { mldsa87 } from "@qorechain/pqc";
import { hybridAccountAbi, hybridSignBytes } from "@stv/core";
import {
  bytesToHex,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  stringToBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LocalChain, artifact, typedArtifact, type Contract, type TestAccount } from "./harness/chain";
import { pqKeypair, type PqKeypair } from "./harness/fixture";

const EXECUTE_TYPEHASH = keccak256(
  stringToBytes("Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)"),
);

const mintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

interface Call {
  target: Address;
  value: bigint;
  data: Hex;
  nonce: bigint;
  deadline: bigint;
}

describe("HybridAccount: HybridAuth guarding arbitrary calls", () => {
  let chain: LocalChain;
  let owner: TestAccount;
  let stranger: TestAccount;
  let pq: PqKeypair;
  let account: Contract<typeof hybridAccountAbi>;
  let token: Contract<typeof erc20Abi>;
  const friend = "0x00000000000000000000000000000000000f00d1" as const;

  const intentOf = (c: Call): Hex =>
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [EXECUTE_TYPEHASH, c.target, c.value, keccak256(c.data), c.nonce, c.deadline],
    );

  const signClassical = (c: Call, key = owner.privateKey) =>
    privateKeyToAccount(key).signTypedData({
      domain: { name: "Hybrid Account", version: "1", chainId: chain.chainId, verifyingContract: account.address },
      types: {
        Execute: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "dataHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Execute",
      message: { target: c.target, value: c.value, dataHash: keccak256(c.data), nonce: c.nonce, deadline: c.deadline },
    });

  const signPq = (c: Call, key = pq.secretKey): Hex =>
    toHex(
      mldsa87.sign(
        key,
        hybridSignBytes({ chainId: chain.chainId, contract: account.address, signer: owner.address, intent: intentOf(c) }),
      ),
    );

  const execute = (c: Call, classical: Hex, postQuantum: Hex, from = stranger) =>
    account.write("execute", [c.target, c.value, c.data, c.deadline, classical, postQuantum], from);

  const transfer = async (amount: bigint): Promise<Call> => ({
    target: token.address,
    value: 0n,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [friend, amount] }),
    nonce: await account.read("nonce", []),
    deadline: chain.now() + 600n,
  });

  beforeEach(async () => {
    chain = await LocalChain.create();
    owner = await chain.account();
    stranger = await chain.account();
    pq = pqKeypair(0x21);
    chain.registerKey(owner.address, pq.publicKey);
    account = await chain.deploy(typedArtifact("HybridAccount", hybridAccountAbi), [owner.address], stranger);
    const deployed = await chain.deploy(artifact("TestToken"), [], stranger);
    token = chain.at(erc20Abi, deployed.address);
    await chain.send({
      from: stranger,
      to: token.address,
      data: encodeFunctionData({ abi: mintAbi, functionName: "mint", args: [account.address, 1000n] }),
    });
  });

  it("builds the same intent and sign-bytes as the TypeScript side", async () => {
    const call = await transfer(10n);
    const onChainIntent = await account.read("executeIntent", [call.target, call.value, call.data, call.deadline]);
    assert.equal(onChainIntent, intentOf(call));
    assert.equal(
      await account.read("hybridSignBytes", [owner.address, onChainIntent]),
      bytesToHex(
        hybridSignBytes({ chainId: chain.chainId, contract: account.address, signer: owner.address, intent: intentOf(call) }),
      ),
    );
  });

  it("moves tokens when both keys signed for exactly this call", async () => {
    const call = await transfer(250n);
    const tx = await execute(call, await signClassical(call), signPq(call));
    assert.equal(tx.status, "success");
    assert.equal(await token.read("balanceOf", [friend]), 250n);
    assert.equal(await account.read("nonce", []), 1n);
    assert.ok(tx.logs.some((l) => l.eventName === "Executed"));
  });

  it("reverts with the classical key alone, whoever sends it", async () => {
    const call = await transfer(250n);
    const viaRelayer = await execute(call, await signClassical(call), "0x");
    assert.equal(viaRelayer.status, "reverted");
    assert.deepEqual(viaRelayer.error, { name: "PostQuantumSignatureRejected", args: [2] }); // SignatureMalformed

    const asOwner = await execute(call, "0x", "0x", owner);
    assert.equal(asOwner.status, "reverted");
    assert.equal(asOwner.error?.name, "PostQuantumSignatureRejected");
    assert.equal(await token.read("balanceOf", [friend]), 0n);
  });

  it("reverts with the post-quantum key alone", async () => {
    const call = await transfer(250n);
    const tx = await execute(call, "0x", signPq(call));
    assert.equal(tx.status, "reverted");
    assert.equal(tx.error?.name, "ClassicalSignatureRejected");
  });

  it("reverts when the signed call data is swapped for another call", async () => {
    const signedFor = await transfer(1n);
    const swapped: Call = {
      ...signedFor,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [stranger.address, 1000n] }),
    };
    const tx = await execute(swapped, await signClassical(signedFor), signPq(signedFor), owner);
    assert.equal(tx.status, "reverted");
    assert.deepEqual(tx.error, { name: "PostQuantumSignatureRejected", args: [3] }); // SignatureInvalid
    assert.equal(await token.read("balanceOf", [stranger.address]), 0n);
  });

  it("a used authorisation cannot be replayed", async () => {
    const call = await transfer(100n);
    const classical = await signClassical(call);
    const postQuantum = signPq(call);
    assert.equal((await execute(call, classical, postQuantum)).status, "success");
    const replay = await execute(call, classical, postQuantum);
    assert.equal(replay.status, "reverted");
    assert.equal(await token.read("balanceOf", [friend]), 100n);
  });

  it("an expired authorisation reverts", async () => {
    const call = await transfer(100n);
    const classical = await signClassical(call);
    const postQuantum = signPq(call);
    chain.warp(601);
    const tx = await execute(call, classical, postQuantum);
    assert.equal(tx.status, "reverted");
    assert.equal(tx.error?.name, "Expired");
  });

  it("a failing inner call reverts the whole thing and keeps the nonce", async () => {
    const call = await transfer(5000n); // more than the account holds
    const tx = await execute(call, await signClassical(call), signPq(call));
    assert.equal(tx.status, "reverted");
    assert.equal(tx.error?.name, "CallFailed");
    assert.equal(await account.read("nonce", []), 0n);
  });

  it("sends native value under the same rule", async () => {
    await chain.send({ from: stranger, to: account.address, value: 10n ** 18n });
    const call: Call = { target: friend, value: 4n * 10n ** 17n, data: "0x", nonce: 0n, deadline: chain.now() + 60n };
    assert.equal((await execute(call, await signClassical(call), "0x")).status, "reverted");
    assert.equal((await execute(call, await signClassical(call), signPq(call))).status, "success");
    assert.equal(await chain.balance(friend), 4n * 10n ** 17n);
  });
});
