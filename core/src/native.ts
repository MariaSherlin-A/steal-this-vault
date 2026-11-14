/**
 * QoreChain's native lane: where the post-quantum signature is mandatory.
 *
 * Everything goes over the REST API with `fetch`, so the same code runs in
 * Node (the CLI, the keeper, the tests) and in a browser (the site, through a
 * same-origin proxy, because the public REST endpoint sends no CORS headers).
 */
import {
  EthNativeSigner,
  MSG_SEND_TYPE_URL,
  buildRegisterPqcKeyMsg,
  clearPqcStatusCache,
  closeEvmWindowMsg,
  deriveUnifiedAccount,
  evmToQor,
  fetchEvmWindow,
  fetchPqcStatus,
  generateMnemonic,
  openEvmWindowMsg,
  signProofOfPossession,
  unifiedAccountFromSeed,
  type UnifiedAccount,
} from "@qorechain/sdk";
import { hexToBytes, type Address, type Hex } from "viem";
import { TESTNET, WEI_PER_UQOR } from "./chain";

export type { UnifiedAccount };

/** `hybrid`: secp256k1 + ML-DSA-87, what the chain requires. `classical`: secp256k1 alone, what a thief has. */
export type SignMode = "hybrid" | "classical";

/** A message for a native transaction: type URL and value, as the SDK builds them. */
export interface NativeMessage {
  typeUrl: string;
  value: unknown;
}

export interface NativeResult {
  /** True when the transaction was included in a block with code 0. */
  accepted: boolean;
  /** Where it stopped: refused before entering a block, failed inside one, or never reached the node. */
  stage: "admission" | "execution" | "transport" | "included";
  code: number;
  codespace: string;
  /** The chain's own words, on refusal. */
  log: string;
  hash?: string;
  height?: number;
  gasUsed?: bigint;
}

interface TxResponseJson {
  code?: number;
  codespace?: string;
  txhash?: string;
  raw_log?: string;
  height?: string;
  gas_used?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** A native fee for a gas limit, at the SDK's 0.15 uqor per gas (the floor is 0.1). */
export function nativeFee(gas: number): { amount: { denom: string; amount: string }[]; gas: string } {
  return { amount: [{ denom: "uqor", amount: String(Math.ceil(gas * 0.15)) }], gas: String(gas) };
}

/** Enough for a hybrid-signed bank send or window message (they use about 190,000). */
export const DEFAULT_NATIVE_GAS = 260_000;
/** Key registration is larger: it carries a 2592-byte key and a 4627-byte proof. */
export const REGISTER_NATIVE_GAS = 600_000;

export class NativeLane {
  readonly rest: string;
  readonly chainId: string;

  constructor(options: { rest?: string; chainId?: string } = {}) {
    this.rest = (options.rest ?? TESTNET.rest).replace(/\/+$/, "");
    this.chainId = options.chainId ?? TESTNET.nativeChainId;
  }

  private async get<T>(path: string): Promise<{ status: number; body: T | null }> {
    const res = await fetch(`${this.rest}${path}`);
    return { status: res.status, body: (await res.json().catch(() => null)) as T | null };
  }

  /** Account number and sequence. Null for an account the chain has never seen. */
  async account(address: string): Promise<{ accountNumber: bigint; sequence: bigint } | null> {
    const { status, body } = await this.get<{ account?: Record<string, unknown> }>(
      `/cosmos/auth/v1beta1/accounts/${address}`,
    );
    if (status === 404 || !body?.account) return null;
    const a = (body.account.base_account ?? body.account) as Record<string, string | undefined>;
    if (a.account_number === undefined) return null;
    return { accountNumber: BigInt(a.account_number), sequence: BigInt(a.sequence ?? "0") };
  }

  /** Liquid balance in uqor. */
  async balance(address: string): Promise<bigint> {
    const { body } = await this.get<{ balance?: { amount?: string } }>(
      `/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=uqor`,
    );
    return BigInt(body?.balance?.amount ?? "0");
  }

  /** The account's EVM authorisation window, as the chain reports it. */
  window(address: string) {
    return fetchEvmWindow({ rest: this.rest, address });
  }

  /** The account's registered post-quantum key, read fresh. */
  pqcStatus(address: string) {
    clearPqcStatusCache();
    return fetchPqcStatus({ rest: this.rest, address });
  }

  /** A committed transaction, or null if the node does not have it (yet). */
  async tx(hash: string): Promise<{ tx?: { body?: Record<string, unknown> }; tx_response?: TxResponseJson } | null> {
    const { status, body } = await this.get<{ tx?: { body?: Record<string, unknown> }; tx_response?: TxResponseJson }>(
      `/cosmos/tx/v1beta1/txs/${hash}`,
    );
    return status === 200 ? body : null;
  }

  /** Submit signed transaction bytes. With `wait`, follow an admitted transaction into its block. */
  async broadcast(txBytes: Uint8Array, wait = true): Promise<NativeResult> {
    let response: TxResponseJson | undefined;
    try {
      const res = await fetch(`${this.rest}/cosmos/tx/v1beta1/txs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tx_bytes: toBase64(txBytes), mode: "BROADCAST_MODE_SYNC" }),
      });
      const json = (await res.json().catch(() => null)) as { tx_response?: TxResponseJson; message?: string } | null;
      response = json?.tx_response;
      if (!response) {
        return { accepted: false, stage: "transport", code: -1, codespace: "", log: json?.message ?? `HTTP ${res.status}` };
      }
    } catch (error) {
      return { accepted: false, stage: "transport", code: -1, codespace: "", log: String(error) };
    }

    const code = response.code ?? 0;
    if (code !== 0) {
      return {
        accepted: false,
        stage: "admission",
        code,
        codespace: response.codespace ?? "",
        log: response.raw_log ?? "",
        hash: response.txhash,
      };
    }
    if (!wait || !response.txhash) {
      return { accepted: true, stage: "admission", code: 0, codespace: "", log: "", hash: response.txhash };
    }

    for (let attempt = 0; attempt < 40; attempt++) {
      await sleep(1500);
      const found = await this.tx(response.txhash);
      const r = found?.tx_response;
      if (!r) continue;
      const finalCode = r.code ?? 0;
      return {
        accepted: finalCode === 0,
        stage: finalCode === 0 ? "included" : "execution",
        code: finalCode,
        codespace: r.codespace ?? "",
        log: finalCode === 0 ? "" : (r.raw_log ?? ""),
        hash: response.txhash,
        height: r.height ? Number(r.height) : undefined,
        gasUsed: r.gas_used ? BigInt(r.gas_used) : undefined,
      };
    }
    return {
      accepted: false,
      stage: "transport",
      code: -1,
      codespace: "",
      log: "admitted, but not found in a block after 60 seconds",
      hash: response.txhash,
    };
  }

  /**
   * Sign and submit a native transaction.
   *
   * `mode: "classical"` leaves out the ML-DSA-87 signature, which is all a holder
   * of the secp256k1 key can do. The chain refuses it at admission.
   */
  async send(
    account: UnifiedAccount,
    messages: NativeMessage[],
    options: { mode?: SignMode; gas?: number; memo?: string; wait?: boolean } = {},
  ): Promise<NativeResult> {
    const mode = options.mode ?? "hybrid";
    const state = await this.account(account.cosmos);
    if (!state) {
      return {
        accepted: false,
        stage: "transport",
        code: -1,
        codespace: "",
        log: `account ${account.cosmos} does not exist on chain yet`,
      };
    }
    const signer = new EthNativeSigner(account, { signMode: mode, rest: this.rest });
    const signed = signer.sign({
      chainId: this.chainId,
      accountNumber: state.accountNumber,
      sequence: state.sequence,
      messages: messages as Parameters<EthNativeSigner["sign"]>[0]["messages"],
      fee: nativeFee(options.gas ?? DEFAULT_NATIVE_GAS),
      memo: options.memo,
      signBytesVersion: mode === "hybrid" ? await signer.resolveSignBytesVersion(this.chainId) : undefined,
    });
    return this.broadcast(signed.txRawBytes, options.wait ?? true);
  }
}

// ---------------------------------------------------------------- accounts

/** The real owner: both keys, from the secret mnemonic. */
export function accountFromMnemonic(mnemonic: string): Promise<UnifiedAccount> {
  return deriveUnifiedAccount(mnemonic.trim());
}

/**
 * What a thief has: the secp256k1 private key and nothing else. The account
 * object needs a post-quantum keypair to be well formed, so it gets one that
 * has nothing to do with the owner's. Signing "hybrid" with this account
 * models a thief who brings a post-quantum key of their own.
 */
export function accountFromStolenKey(privateKey: Hex): UnifiedAccount {
  const pqcSecret = new Uint8Array(32);
  crypto.getRandomValues(pqcSecret);
  return unifiedAccountFromSeed(hexToBytes(privateKey), { pqcSecret });
}

/** A new 24-word mnemonic. */
export function newMnemonic(): string {
  return generateMnemonic(256);
}

/** The native (`qor1...`) form of an EVM address. Both name the same account. */
export function nativeAddress(evm: Address): string {
  return evmToQor(evm);
}

/**
 * Register the account's ML-DSA-87 key, with proof of possession, if it has none.
 * This is the one transaction the chain accepts with a classical signature alone:
 * until it lands the account has no post-quantum protection, so do it before funding.
 */
export async function ensurePqcKeyRegistered(lane: NativeLane, account: UnifiedAccount): Promise<NativeResult | "already"> {
  const status = await lane.pqcStatus(account.cosmos);
  if (status.registered) return "already";
  const proofOfPossession = signProofOfPossession({
    chainId: lane.chainId,
    account: account.cosmos,
    keypair: account.pqc,
  });
  const msg = buildRegisterPqcKeyMsg(account.cosmos, { pqcKeypair: account.pqc, keyType: "hybrid", proofOfPossession });
  return lane.send(account, [msg], { mode: "classical", gas: REGISTER_NATIVE_GAS });
}

// ---------------------------------------------------------------- messages

export const messages = {
  /** Move native QOR. Amount in uqor. */
  send(from: string, to: string, uqor: bigint): NativeMessage {
    return {
      typeUrl: MSG_SEND_TYPE_URL,
      value: { fromAddress: from, toAddress: to, amount: [{ denom: "uqor", amount: uqor.toString() }] },
    };
  },

  /** Open an EVM authorisation window. With `allowedTargets`, EVM transactions may go only to those contracts. */
  openWindow(args: {
    sender: string;
    blocks: bigint;
    maxTxs: bigint;
    maxValueUqor: bigint;
    allowedTargets?: readonly Address[];
    nativeOnly?: boolean;
  }): NativeMessage {
    return openEvmWindowMsg({
      sender: args.sender,
      blocks: args.blocks,
      maxTxs: args.maxTxs,
      maxValue: args.maxValueUqor.toString(),
      ...(args.allowedTargets ? { allowedTargets: [...args.allowedTargets] } : {}),
      ...(args.nativeOnly ? { nativeOnly: true } : {}),
    } as Parameters<typeof openEvmWindowMsg>[0]);
  },

  closeWindow(sender: string): NativeMessage {
    return closeEvmWindowMsg(sender);
  },
};

/** uqor needed to cover an EVM transaction's value and maximum fee inside a window. */
export function windowCostUqor(tx: { gas: bigint; maxFeePerGas: bigint; value?: bigint }): bigint {
  const wei = (tx.value ?? 0n) + tx.gas * tx.maxFeePerGas;
  return (wei + WEI_PER_UQOR - 1n) / WEI_PER_UQOR;
}
