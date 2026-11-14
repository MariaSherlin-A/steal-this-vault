import { mldsa87 } from "@qorechain/pqc";
import {
  signWithdrawal,
  vaultAbi,
  type SignedWithdrawal,
  type VaultRef,
  type WithdrawIntent,
} from "@stv/core";
import { parseEther, type Address, type Hex } from "viem";
import { LocalChain, typedArtifact, type Contract, type TestAccount } from "./chain";

export const QOR = parseEther("1");

export interface PqKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** A deterministic ML-DSA-87 keypair for tests. */
export function pqKeypair(seedByte: number): PqKeypair {
  return mldsa87.keygen(new Uint8Array(32).fill(seedByte));
}

export type VaultContract = Contract<typeof vaultAbi>;

export interface World {
  chain: LocalChain;
  /** The vault owner: a secp256k1 account with an ML-DSA-87 key on record. */
  owner: TestAccount;
  ownerPq: PqKeypair;
  /** Someone with no keys of the owner's, who pays for gas. */
  stranger: TestAccount;
  /** A third party that funds the vaults. */
  funder: TestAccount;
  /** postQuantum = true */
  hybrid: VaultContract;
  /** postQuantum = false: the control */
  classic: VaultContract;
  /** A recipient with no code and no balance. */
  recipient: Address;
}

export const vaultArtifact = () => typedArtifact("Vault", vaultAbi);

/** Two vaults with the same owner and 10 QOR each. */
export async function deployWorld(options: { chainId?: number } = {}): Promise<World> {
  const chain = await LocalChain.create(options);
  const owner = await chain.account();
  const stranger = await chain.account();
  const funder = await chain.account();
  const ownerPq = pqKeypair(0x51);
  chain.registerKey(owner.address, ownerPq.publicKey);

  const art = vaultArtifact();
  const hybrid = await chain.deploy(art, [owner.address, true], funder);
  const classic = await chain.deploy(art, [owner.address, false], funder);
  for (const vault of [hybrid, classic]) {
    const funded = await chain.send({ from: funder, to: vault.address, value: 10n * QOR });
    if (funded.status !== "success") throw new Error("funding failed");
  }
  return {
    chain,
    owner,
    ownerPq,
    stranger,
    funder,
    hybrid,
    classic,
    recipient: "0x00000000000000000000000000000000000B0b01",
  };
}

export function ref(world: World, vault: VaultContract): VaultRef {
  return { address: vault.address, chainId: world.chain.chainId, owner: world.owner.address };
}

/** An intent for the vault's current nonce, valid for the next hour. */
export async function intentFor(
  world: World,
  vault: VaultContract,
  overrides: Partial<WithdrawIntent> = {},
): Promise<WithdrawIntent> {
  return {
    to: world.recipient,
    amount: QOR,
    nonce: await vault.read("nonce", []),
    deadline: world.chain.now() + 3600n,
    ...overrides,
  };
}

/** Sign an intent the way the real owner would, with both keys. */
export async function ownerSigns(world: World, vault: VaultContract, intent: WithdrawIntent): Promise<SignedWithdrawal> {
  return signWithdrawal(
    { privateKey: world.owner.privateKey, pqSecretKey: world.ownerPq.secretKey },
    ref(world, vault),
    intent,
  );
}

/** Submit a withdrawal. */
export async function withdraw(
  vault: VaultContract,
  from: TestAccount,
  intent: WithdrawIntent,
  classicalSignature: Hex = "0x",
  postQuantumSignature: Hex = "0x",
) {
  return vault.write(
    "withdraw",
    [intent.to, intent.amount, intent.nonce, intent.deadline, classicalSignature, postQuantumSignature],
    from,
  );
}

/** Ask the vault what it would decide, as `from`, without sending anything. */
export async function judge(
  vault: VaultContract,
  from: Address,
  intent: WithdrawIntent,
  classicalSignature: Hex = "0x",
  postQuantumSignature: Hex = "0x",
): Promise<{ refusal: number; keyholder: boolean }> {
  const [refusal, keyholder] = await vault.read(
    "judge",
    [intent.to, intent.amount, intent.nonce, intent.deadline, classicalSignature, postQuantumSignature],
    from,
  );
  return { refusal, keyholder };
}
