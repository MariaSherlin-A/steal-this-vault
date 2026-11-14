/** QoreChain's EVM lane: reads, fee handling and transactions signed with a secp256k1 key alone. */
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "./abi";
import { TESTNET, chain } from "./chain";
import { refusalName, type RefusalName } from "./refusal";

export type EvmClient = PublicClient<ReturnType<typeof http>, typeof chain>;

export function evmClient(evmRpc: string = TESTNET.evmRpc): EvmClient {
  return createPublicClient({ chain, transport: http(evmRpc) });
}

/** Fees for the next block: the base fee plus a small tip, with no headroom wasted. */
export async function nextFees(client: EvmClient): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const block = await client.getBlock({ blockTag: "latest" });
  const base = block.baseFeePerGas ?? (await client.getGasPrice());
  // The base fee has been a constant 100 gwei on testnet; allow one step up.
  const maxPriorityFeePerGas = TIP_WEI;
  return { maxFeePerGas: base + base / 8n + maxPriorityFeePerGas, maxPriorityFeePerGas };
}

/** Priority fee offered on every transaction this project sends. */
export const TIP_WEI = 1_000_000_000n; // 1 gwei

export interface EvmSendResult {
  /** The node accepted the transaction and it was mined. */
  admitted: boolean;
  hash?: Hex;
  receipt?: TransactionReceipt;
  /** The node's refusal, when it was not admitted. */
  refusal?: EvmRefusal;
}

export interface EvmRefusal {
  /** A short machine-readable reason. */
  kind:
    | "no-window"
    | "window-exhausted"
    | "target-not-allowed"
    | "window-scope"
    | "no-pqc-key"
    | "delegation-consent"
    | "nonce"
    | "funds"
    | "other";
  /** The node's own message, trimmed. */
  message: string;
}

/** Turn a node error into the reason the chain gave. */
export function classifyEvmRefusal(error: unknown): EvmRefusal {
  const raw =
    error instanceof BaseError
      ? [error.details, error.shortMessage, error.message].filter(Boolean).join(" | ")
      : error instanceof Error
        ? error.message
        : String(error);
  const message = raw.replace(/\s+/g, " ").trim();
  const text = message.toLowerCase();

  let kind: EvmRefusal["kind"] = "other";
  if (text.includes("no open evm authorisation window")) kind = "no-window";
  else if (text.includes("allowed recipient") || text.includes("allowed target") || text.includes("allowed_targets"))
    kind = "target-not-allowed";
  else if (text.includes("native-only") || text.includes("native only") || text.includes("contract creation")) kind = "window-scope";
  else if (text.includes("window exhausted") || text.includes("does not admit this transaction")) kind = "window-exhausted";
  else if (text.includes("no registered pqc key") || text.includes("has no pqc key")) kind = "no-pqc-key";
  else if (text.includes("delegation")) kind = "delegation-consent";
  else if (text.includes("nonce") || text.includes("sequence")) kind = "nonce";
  else if (text.includes("insufficient funds") || text.includes("insufficient balance")) kind = "funds";

  // Keep the chain's sentence, drop the Go error-wrapping noise after it.
  const short = message.split(" [cosmossdk.io")[0]!.split(" Request Arguments")[0]!.split(" URL:")[0]!;
  return { kind, message: short.slice(0, 400) };
}

export interface EvmTxRequest {
  to?: Address;
  data?: Hex;
  value?: bigint;
  /** Gas limit. When omitted it is estimated and padded by 15%. */
  gas?: bigint;
  /** Used when estimation is impossible (the transaction would be refused). */
  fallbackGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
}

/**
 * Sign a transaction with a secp256k1 key and send it straight to the node,
 * the way MetaMask would. Returns the node's refusal instead of throwing.
 */
export async function sendWithKey(
  client: EvmClient,
  privateKey: Hex,
  request: EvmTxRequest,
  options: { wait?: boolean; evmRpc?: string } = {},
): Promise<EvmSendResult> {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, chain, transport: http(options.evmRpc ?? client.transport.url) });

  const fees = await nextFees(client);
  let gas = request.gas;
  if (gas === undefined) {
    try {
      const estimate = await client.estimateGas({
        account: account.address,
        to: request.to,
        data: request.data,
        value: request.value,
      });
      gas = (estimate * 115n) / 100n + 2_000n;
    } catch {
      gas = request.fallbackGas ?? 120_000n;
    }
  }

  let hash: Hex;
  try {
    hash = await wallet.sendTransaction({
      to: request.to,
      data: request.data,
      value: request.value ?? 0n,
      gas,
      maxFeePerGas: request.maxFeePerGas ?? fees.maxFeePerGas,
      maxPriorityFeePerGas: request.maxPriorityFeePerGas ?? fees.maxPriorityFeePerGas,
      nonce: request.nonce,
    });
  } catch (error) {
    return { admitted: false, refusal: classifyEvmRefusal(error) };
  }
  if (options.wait === false) return { admitted: true, hash };
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000, pollingInterval: 1_000 });
  return { admitted: true, hash, receipt };
}

// ---------------------------------------------------------------- vault reads

export interface VaultStats {
  balance: bigint;
  nonce: bigint;
  paidTotal: bigint;
  counterfactualLoss: bigint;
  paidCount: bigint;
  refusedCount: bigint;
  keyholderRefusedCount: bigint;
  counterfactualThefts: bigint;
  deployedAt: bigint;
  lastPaidAt: bigint;
  lastRefusedAt: bigint;
  refusedBy: Record<RefusalName, bigint>;
}

export interface VaultEntry {
  caller: Address;
  blockNumber: bigint;
  refusal: RefusalName;
  keyholder: boolean;
}

export async function readStats(client: EvmClient, vault: Address): Promise<VaultStats> {
  const s = await client.readContract({ address: vault, abi: vaultAbi, functionName: "stats" });
  const refusedBy = {} as Record<RefusalName, bigint>;
  s.refusedBy.forEach((count, code) => {
    refusedBy[refusalName(code)] = count;
  });
  return {
    balance: s.balance,
    nonce: s.nonce,
    paidTotal: s.paidTotal,
    counterfactualLoss: s.counterfactualLoss,
    paidCount: s.paidCount,
    refusedCount: s.refusedCount,
    keyholderRefusedCount: s.keyholderRefusedCount,
    counterfactualThefts: s.counterfactualThefts,
    deployedAt: s.deployedAt,
    lastPaidAt: s.lastPaidAt,
    lastRefusedAt: s.lastRefusedAt,
    refusedBy,
  };
}

export async function readRecent(client: EvmClient, vault: Address): Promise<VaultEntry[]> {
  const entries = await client.readContract({ address: vault, abi: vaultAbi, functionName: "recent" });
  return entries.map((e) => ({
    caller: e.caller,
    blockNumber: BigInt(e.blockNumber),
    refusal: refusalName(e.refusal),
    keyholder: e.keyholder,
  }));
}

/** Ask a vault what it would decide for `from`, without sending anything. */
export async function askVault(
  client: EvmClient,
  vault: Address,
  from: Address,
  args: readonly [Address, bigint, bigint, bigint, Hex, Hex],
): Promise<{ refusal: RefusalName; keyholder: boolean }> {
  const [refusal, keyholder] = await client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "judge",
    args,
    account: from,
  });
  return { refusal: refusalName(refusal), keyholder };
}
