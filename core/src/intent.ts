/**
 * Hybrid intents: one statement of what should happen, signed by two keys.
 *
 * The same bytes are built here and in `HybridAuth.sol`; the contract tests
 * check that the two agree.
 */
import { mldsa87 } from "@qorechain/pqc";
import {
  concatBytes,
  encodeAbiParameters,
  encodeFunctionData,
  hashTypedData,
  hexToBytes,
  keccak256,
  pad,
  stringToBytes,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "./abi";
import { ML_DSA_87 } from "./chain";

/** First bytes of everything the post-quantum key signs. Mirrors `HybridAuth.PQ_DOMAIN_TAG`. */
export const PQ_DOMAIN_TAG = "\x19Qore Hybrid Intent v1\n";

/** EIP-712 domain name and version of the Vault contract. */
export const VAULT_DOMAIN = { name: "Steal This Vault", version: "1" } as const;

export const WITHDRAW_TYPES = {
  Withdraw: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const WITHDRAW_TYPEHASH = keccak256(
  stringToBytes("Withdraw(address to,uint256 amount,uint256 nonce,uint256 deadline)"),
);

/** Where an intent is valid: one vault on one chain, for one owner. */
export interface VaultRef {
  address: Address;
  chainId: number;
  owner: Address;
}

export interface WithdrawIntent {
  to: Address;
  amount: bigint;
  nonce: bigint;
  /** Unix seconds. The vault compares it with block time. */
  deadline: bigint;
}

/** The EIP-712 typed data the secp256k1 key signs. Wallets can display it. */
export function withdrawTypedData(vault: VaultRef, intent: WithdrawIntent) {
  return {
    domain: { ...VAULT_DOMAIN, chainId: vault.chainId, verifyingContract: vault.address },
    types: WITHDRAW_TYPES,
    primaryType: "Withdraw",
    message: intent,
  } as const;
}

/** The EIP-712 digest. Equals `Vault.withdrawDigest`. */
export function withdrawDigest(vault: VaultRef, intent: WithdrawIntent): Hex {
  return hashTypedData(withdrawTypedData(vault, intent));
}

/** `abi.encode(TYPEHASH, to, amount, nonce, deadline)`. Equals `Vault.withdrawIntent`. */
export function withdrawIntentBytes(intent: WithdrawIntent): Hex {
  return encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    [WITHDRAW_TYPEHASH, intent.to, intent.amount, intent.nonce, intent.deadline],
  );
}

/**
 * What the ML-DSA-87 key signs: tag, chain id, contract, signer, intent.
 * Equals `HybridAuth.hybridSignBytes`.
 */
export function hybridSignBytes(args: { chainId: number; contract: Address; signer: Address; intent: Hex }): Uint8Array {
  return concatBytes([
    // The tag holds a 0x19 byte, so it is encoded byte for byte, not as UTF-8 text.
    Uint8Array.from(PQ_DOMAIN_TAG, (c) => c.charCodeAt(0)),
    toBytes(pad(toHex(BigInt(args.chainId)), { size: 32 })),
    hexToBytes(args.contract),
    hexToBytes(args.signer),
    hexToBytes(args.intent),
  ]);
}

/** Equals `Vault.withdrawSignBytes`. */
export function withdrawSignBytes(vault: VaultRef, intent: WithdrawIntent): Uint8Array {
  return hybridSignBytes({
    chainId: vault.chainId,
    contract: vault.address,
    signer: vault.owner,
    intent: withdrawIntentBytes(intent),
  });
}

/** Sign with the secp256k1 key. Returns the 65-byte signature. */
export async function signClassical(privateKey: Hex, vault: VaultRef, intent: WithdrawIntent): Promise<Hex> {
  return privateKeyToAccount(privateKey).signTypedData(withdrawTypedData(vault, intent));
}

/** Sign with the ML-DSA-87 secret key. Returns the 4627-byte signature. */
export function signPostQuantum(secretKey: Uint8Array, vault: VaultRef, intent: WithdrawIntent): Hex {
  if (secretKey.length !== ML_DSA_87.secretKeyLength) {
    throw new Error(`ML-DSA-87 secret key must be ${ML_DSA_87.secretKeyLength} bytes, got ${secretKey.length}`);
  }
  return toHex(mldsa87.sign(secretKey, withdrawSignBytes(vault, intent)));
}

/** Check a post-quantum signature locally, the way the chain's precompile does. Never throws. */
export function verifyPostQuantum(
  publicKey: Uint8Array | Hex,
  vault: VaultRef,
  intent: WithdrawIntent,
  signature: Uint8Array | Hex,
): boolean {
  const key = typeof publicKey === "string" ? hexToBytes(publicKey) : publicKey;
  const sig = typeof signature === "string" ? hexToBytes(signature) : signature;
  return mldsa87.verify(key, withdrawSignBytes(vault, intent), sig);
}

/** Call data for `Vault.withdraw`. */
export function encodeWithdraw(intent: WithdrawIntent, classicalSignature: Hex = "0x", postQuantumSignature: Hex = "0x"): Hex {
  return encodeFunctionData({
    abi: vaultAbi,
    functionName: "withdraw",
    args: [intent.to, intent.amount, intent.nonce, intent.deadline, classicalSignature, postQuantumSignature],
  });
}

/** A fully signed withdrawal, ready for anyone to submit. */
export interface SignedWithdrawal {
  intent: WithdrawIntent;
  classicalSignature: Hex;
  postQuantumSignature: Hex;
  calldata: Hex;
}

/** Sign an intent with both keys. Only the real owner can do this. */
export async function signWithdrawal(
  keys: { privateKey: Hex; pqSecretKey: Uint8Array },
  vault: VaultRef,
  intent: WithdrawIntent,
): Promise<SignedWithdrawal> {
  const classicalSignature = await signClassical(keys.privateKey, vault, intent);
  const postQuantumSignature = signPostQuantum(keys.pqSecretKey, vault, intent);
  return {
    intent,
    classicalSignature,
    postQuantumSignature,
    calldata: encodeWithdraw(intent, classicalSignature, postQuantumSignature),
  };
}
