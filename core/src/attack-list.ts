/**
 * The attack catalogue: everything a thief can try with the owner's secp256k1
 * key and nothing else. This file holds only the descriptions, so the site can
 * show the list before it loads the code that runs them (`attacks.ts`).
 *
 * `plain` is written for someone who has never used a blockchain.
 * `technical` is written for someone who builds them.
 */

export type AttackGroup = "native" | "evm" | "vault" | "control";

export interface AttackInfo {
  id: string;
  group: AttackGroup;
  /** What the thief is trying to do, in a few words. */
  title: string;
  plain: string;
  technical: string;
  /** The control vault is supposed to be robbed; everything else is supposed to fail. */
  expects: "refused" | "paid";
}

export const GROUPS: Record<AttackGroup, { title: string; plain: string; technical: string }> = {
  native: {
    title: "Take the money directly",
    plain: "The simplest theft: use the stolen key to send the owner's coins away, or to change the account's locks.",
    technical:
      "Native-lane transactions signed with secp256k1 only. The chain's ante handler requires the hybrid ML-DSA-87 extension from any account with a registered post-quantum key.",
  },
  evm: {
    title: "Go through the side door",
    plain: "The chain has a second entrance that ordinary wallets use. It only opens when the owner unlocks it with both keys, and only as far as the owner chose.",
    technical:
      "EVM-lane transactions signed with the secp256k1 key. They are admitted only inside an EVM authorisation window the owner opened with a hybrid signature, and only within its scope.",
  },
  vault: {
    title: "Fool the vault",
    plain: "The side door is open and it leads to the vault. The thief is now standing in front of it with the stolen key in hand.",
    technical:
      "Calls to Vault.withdraw on the hybrid vault from the owner account, inside a window scoped to the vault. The contract itself asks for an ML-DSA-87 signature over the withdrawal intent.",
  },
  control: {
    title: "The control: the same vault with one lock",
    plain: "An identical vault that only checks the ordinary key, the way vaults work on other chains. Robbing it is supposed to work.",
    technical: "The same Vault bytecode deployed with postQuantum = false.",
  },
};

export const ATTACKS: readonly AttackInfo[] = [
  // ------------------------------------------------------------------ native
  {
    id: "native-transfer",
    group: "native",
    title: "Send the owner's coins to my wallet",
    plain: "Sign a payment from the owner's account with the stolen key and send it.",
    technical: "MsgSend from the owner, signed with secp256k1 only (no PQCHybridSignature extension).",
    expects: "refused",
  },
  {
    id: "native-own-pq-key",
    group: "native",
    title: "Add a second key of my own",
    plain: "The chain wants two signatures, so make up a second key and sign with that.",
    technical: "MsgSend with a hybrid extension signed by an ML-DSA-87 key that is not the one on record for the account.",
    expects: "refused",
  },
  {
    id: "native-replace-key",
    group: "native",
    title: "Swap the owner's second lock for mine",
    plain: "Tell the chain the account has a new second key: the thief's.",
    technical:
      "MsgRegisterPQCKeyV2 for the owner's account with the thief's key and a valid proof of possession, signed classically the way a first registration is.",
    expects: "refused",
  },
  {
    id: "native-open-window",
    group: "native",
    title: "Unlock the side door myself",
    plain: "Ask the chain to open the Ethereum-style entrance for this account, with no limits.",
    technical: "MsgOpenEVMWindow, unscoped, at the maximum bounds, signed with secp256k1 only.",
    expects: "refused",
  },
  {
    id: "native-authz",
    group: "native",
    title: "Give my own account permission to spend",
    plain: "Have the owner's account authorise the thief's account to make payments for it.",
    technical: "authz MsgGrant of a GenericAuthorization for MsgSend to the thief's address, signed with secp256k1 only.",
    expects: "refused",
  },
  {
    id: "native-7702-consent",
    group: "native",
    title: "Let my contract take over the account",
    plain: "Approve installing the thief's program on the owner's account.",
    technical: "MsgAuthorizeEVMDelegation (consent for an EIP-7702 delegation) signed with secp256k1 only.",
    expects: "refused",
  },

  // --------------------------------------------------------------------- evm
  {
    id: "evm-transfer",
    group: "evm",
    title: "Send the coins the way MetaMask would",
    plain: "Import the stolen key into an ordinary wallet and press send.",
    technical: "A plain EVM value transfer from the owner account to the thief's address.",
    expects: "refused",
  },
  {
    id: "evm-approve",
    group: "evm",
    title: "Approve my wallet to spend the owner's tokens",
    plain: "Skip the coins and take the tokens: give the thief's wallet an unlimited allowance.",
    technical: "ERC-20 approve(thief, max) on the fUSD token contract from the owner account.",
    expects: "refused",
  },
  {
    id: "evm-deploy",
    group: "evm",
    title: "Deploy my own contract as the owner",
    plain: "Put a program on the chain from the owner's account, to use as a tool for the theft.",
    technical: "A contract-creation transaction from the owner account.",
    expects: "refused",
  },
  {
    id: "evm-7702",
    group: "evm",
    title: "Turn the owner's account into my contract",
    plain: "Use a newer Ethereum feature to make the owner's account run the thief's program.",
    technical: "An EIP-7702 (type 4) transaction whose authorisation tuple is signed with the owner's secp256k1 key.",
    expects: "refused",
  },
  {
    id: "evm-forward",
    group: "evm",
    title: "Move the coins into the weak vault, then rob that",
    plain: "The control vault is easy to rob, so push the owner's coins into it first.",
    technical:
      "A value transfer from the owner account to the control vault. A scoped window limits targets, not value, so the vault itself refuses value from the owner (OwnerCannotDeposit).",
    expects: "refused",
  },

  // ------------------------------------------------------------------- vault
  {
    id: "vault-no-signature",
    group: "vault",
    title: "Ask the vault for everything",
    plain: "Call the vault from the owner's account and ask it to pay out its whole balance.",
    technical: "withdraw(to = thief, amount = balance) from the owner account with no post-quantum signature.",
    expects: "refused",
  },
  {
    id: "vault-forged",
    group: "vault",
    title: "Hand it a fake second signature",
    plain: "The vault wants a second signature of a certain size. Give it random bytes of exactly that size.",
    technical: "withdraw with 4627 random bytes as the ML-DSA-87 signature; pqcVerify runs and rejects it.",
    expects: "refused",
  },
  {
    id: "vault-own-pq-key",
    group: "vault",
    title: "Sign with a second key of my own",
    plain: "Make a real second key, sign the request properly with it, and present that.",
    technical:
      "A genuine ML-DSA-87 signature over the correct sign-bytes, made with a key that is not the owner's registered key.",
    expects: "refused",
  },
  {
    id: "vault-relayed",
    group: "vault",
    title: "Send it through someone else",
    plain: "Sign the request with the stolen key and have a different account deliver it.",
    technical:
      "withdraw from an unrelated account with a valid EIP-712 signature from the owner's secp256k1 key. The classical layer passes on the signature; the post-quantum layer does not.",
    expects: "refused",
  },
  {
    id: "vault-replay",
    group: "vault",
    title: "Replay the owner's last real withdrawal",
    plain: "The owner's genuine withdrawals are public. Copy the last one, both signatures included, and send it again.",
    technical: "The exact call data of the most recent Paid transaction, resubmitted. Its nonce has been used.",
    expects: "refused",
  },
  {
    id: "vault-redirect",
    group: "vault",
    title: "Reuse the owner's real signature for my withdrawal",
    plain: "Take the genuine second signature from the owner's last withdrawal and attach it to a new request that pays the thief.",
    technical:
      "A fresh intent (current nonce, thief as recipient) carrying the ML-DSA-87 signature from the owner's last withdrawal.",
    expects: "refused",
  },

  // ----------------------------------------------------------------- control
  {
    id: "control-rob",
    group: "control",
    title: "Rob the vault with one lock",
    plain: "Do exactly what failed above, against the vault that only checks the ordinary key.",
    technical: "withdraw(to = thief, amount) on the control vault from the owner account with no signatures.",
    expects: "paid",
  },
];

export function attackInfo(id: string): AttackInfo {
  const info = ATTACKS.find((a) => a.id === id);
  if (!info) throw new Error(`unknown attack ${id}`);
  return info;
}
