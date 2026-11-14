/** Mirrors `Vault.Refusal`. The order is the order the vault runs its checks. */
export const Refusal = {
  None: 0,
  Expired: 1,
  WrongNonce: 2,
  NotAuthorized: 3,
  PqKeyUnavailable: 4,
  PqSignatureMalformed: 5,
  PqSignatureInvalid: 6,
} as const;

export type RefusalCode = (typeof Refusal)[keyof typeof Refusal];
export type RefusalName = keyof typeof Refusal;

export const REFUSAL_NAMES = Object.keys(Refusal) as RefusalName[];

export function refusalName(code: number): RefusalName {
  const name = REFUSAL_NAMES[code];
  if (!name) throw new Error(`unknown refusal code ${code}`);
  return name;
}

/** Refusals that only the post-quantum layer produced: the classical lock alone would have paid. */
export function stoppedByPostQuantumLayer(code: number): boolean {
  return code >= Refusal.PqKeyUnavailable;
}

/** Plain words for people who do not know the terms, and the precise version for those who do. */
export const REFUSAL_TEXT: Record<RefusalName, { plain: string; technical: string }> = {
  None: {
    plain: "Paid.",
    technical: "Both layers accepted the intent and the transfer was made.",
  },
  Expired: {
    plain: "That approval ran out of time.",
    technical: "block.timestamp is past the intent's deadline.",
  },
  WrongNonce: {
    plain: "That approval was already used.",
    technical: "The intent's nonce is not the vault's current nonce, so it is a replay or out of order.",
  },
  NotAuthorized: {
    plain: "That is not the owner's ordinary key.",
    technical: "No secp256k1 authority: the caller is not the owner and the EIP-712 signature does not recover to the owner.",
  },
  PqKeyUnavailable: {
    plain: "The second lock could not be read, so the vault stays shut.",
    technical: "pqcKeyStatus gave no usable ML-DSA-87 key with proof of possession for the owner. The vault fails closed.",
  },
  PqSignatureMalformed: {
    plain: "The ordinary key fits. The second lock is missing its key.",
    technical: "The classical layer passed. The post-quantum signature is absent or is not 4627 bytes.",
  },
  PqSignatureInvalid: {
    plain: "The ordinary key fits. The second key is a fake.",
    technical: "The classical layer passed. pqcVerify rejected the ML-DSA-87 signature over the intent's sign-bytes.",
  },
};
