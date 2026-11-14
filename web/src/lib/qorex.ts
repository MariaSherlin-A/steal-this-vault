/**
 * The visitor's own wallet. QoreX signs native-lane transactions with both of
 * the visitor's keys (secp256k1 and ML-DSA-87); the page only hands it the
 * message. Nothing here can see or touch a key.
 */
import { TESTNET } from "@stv/core/chain";
import {
  discoverQorexEip1193,
  getQorexNative,
  hasCapability,
  qorexSignAndBroadcast,
  type QorexSignAndBroadcastResult,
} from "@qorechain/qorex-types";
import { getAddress, isAddress, type Address } from "viem";
import { MSG_SEND_TYPE_URL, encodeMsgSend } from "./msgSend";

export interface Wallet {
  /** `qor1...` address on the native lane. */
  native: string;
  /** The wallet's EVM address, when it shares one. */
  evm?: Address;
}

export type WalletErrorKind = "not-installed" | "too-old" | "rejected" | "failed";

export class WalletError extends Error {
  readonly kind: WalletErrorKind;
  constructor(kind: WalletErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function qorexInstalled(): boolean {
  return getQorexNative() !== undefined;
}

function asWalletError(error: unknown): WalletError {
  if (error instanceof WalletError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const rejected = /reject|denied|declin|cancel/i.test(message);
  return new WalletError(rejected ? "rejected" : "failed", message);
}

/** Ask QoreX for the visitor's addresses on the testnet. */
export async function connect(): Promise<Wallet> {
  const native = getQorexNative();
  if (!native) throw new WalletError("not-installed", "QoreX is not installed in this browser.");
  try {
    await native.enable(TESTNET.nativeChainId);
    const key = await native.getKey(TESTNET.nativeChainId);
    let evm: Address | undefined;
    try {
      const provider = await discoverQorexEip1193({ timeoutMs: 600 });
      const accounts = (await provider?.request({ method: "eth_requestAccounts" })) as unknown;
      const first: unknown = Array.isArray(accounts) ? accounts[0] : undefined;
      if (typeof first === "string" && isAddress(first)) evm = getAddress(first);
    } catch {
      // The EVM address is optional: without it, stolen funds go to a throwaway address.
    }
    return { native: key.bech32Address, evm };
  } catch (error) {
    throw asWalletError(error);
  }
}

export type Payment = QorexSignAndBroadcastResult;

/** Send `uqor` from the visitor to `to` on the native lane. QoreX adds both signatures and broadcasts. */
export async function pay(wallet: Wallet, to: string, uqor: bigint): Promise<Payment> {
  const native = getQorexNative();
  if (!native) throw new WalletError("not-installed", "QoreX is not installed in this browser.");
  if (!hasCapability(native, "signAndBroadcast")) {
    throw new WalletError("too-old", "This version of QoreX cannot send a payment for a page yet. Update QoreX and try again.");
  }
  try {
    return await qorexSignAndBroadcast({
      chainId: TESTNET.nativeChainId,
      messages: [{ typeUrl: MSG_SEND_TYPE_URL, value: encodeMsgSend(wallet.native, to, uqor) }],
      memo: "Steal This Vault: raising the stakes",
    });
  } catch (error) {
    throw asWalletError(error);
  }
}
