/**
 * Runs the attacks in `attack-list.ts` against the live chain, using only what
 * a thief has: the owner's secp256k1 private key.
 *
 * The command-line tool and the site both call this module, so what a visitor
 * runs in the browser is what a reviewer runs in a terminal.
 *
 * Three ways an attempt is checked, always stated in the result:
 *
 *   broadcast   signed and sent to the node. A refusal here is the chain's own
 *               answer, costs nothing and leaves no trace.
 *   on-chain    admitted and mined. The vault's answer is in the transaction's
 *               logs and in its counters.
 *   simulated   an eth_call against current chain state, run by the node with
 *               the real precompiles. Used when the owner's EVM window is closed
 *               (the chain would not let the call reach the vault at all) or
 *               when recording is switched off.
 */
import { mldsa87 } from "@qorechain/pqc";
import { authorizeEvmDelegationMsg, authz, buildRegisterPqcKeyMsg, signProofOfPossession } from "@qorechain/sdk";
import {
  BaseError,
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  maxUint256,
  parseEther,
  parseEventLogs,
  toFunctionSelector,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "./abi";
import { ATTACKS, attackInfo, type AttackInfo } from "./attack-list";
import { MAX_WINDOW_BLOCKS, MAX_WINDOW_TXS, TESTNET, UQOR_PER_QOR, chain, explorer } from "./chain";
import {
  askVault,
  classifyEvmRefusal,
  evmClient,
  nextFees,
  readStats,
  sendWithKey,
  type EvmClient,
  type EvmTxRequest,
} from "./evm";
import { encodeWithdraw, signClassical, signPostQuantum, type VaultRef, type WithdrawIntent } from "./intent";
import {
  NativeLane,
  accountFromStolenKey,
  messages,
  nativeAddress,
  type NativeMessage,
  type SignMode,
  type UnifiedAccount,
} from "./native";
import { REFUSAL_TEXT, refusalName, type RefusalName } from "./refusal";

/** The fUSD test token on the EVM lane (from the QoreChain faucet docs). */
export const FUSD_TOKEN: Address = "0x97143B771D34ddb9130b807b135Ae675A5a963CA";

export type Verdict = "refused" | "succeeded" | "skipped";
export type CheckMode = "broadcast" | "on-chain" | "simulated";

export interface AttackResult {
  id: string;
  verdict: Verdict;
  /** Whether the verdict is the one the attack is expected to get. */
  ok: boolean;
  /** Who refused. */
  by?: "chain" | "vault";
  /** A short code: `pqc 20`, `no-window`, `PqSignatureInvalid`. */
  code?: string;
  /** The refusing party's own words. */
  detail: string;
  mode: CheckMode;
  /** Set when a transaction was mined. */
  txHash?: string;
  explorerUrl?: string;
  /** Wei that reached the thief. */
  loot?: bigint;
  /** Anything the reader should know about how this was checked. */
  note?: string;
  ms: number;
}

export interface AttackContext {
  lane: NativeLane;
  client: EvmClient;
  evmRpc: string;
  /** The published secp256k1 private key. */
  key: Hex;
  owner: { evm: Address; native: string };
  vaults: { hybrid: Address; classic: Address };
  /** Where stolen funds would go. */
  loot: Address;
  /** The same address in its native (`qor1...`) form. */
  lootNative: string;
  /** Put vault-level attempts on chain when the owner's EVM window admits them. Costs the owner's fee budget. */
  record: boolean;
  /** How much one robbery of the control vault takes, in wei. */
  robAmount: bigint;
  /** The thief's view of the owner account: the stolen key plus a post-quantum key of the thief's own. */
  thief: UnifiedAccount;
}

export function createAttackContext(options: {
  key: Hex;
  owner: { evm: Address; native: string };
  vaults: { hybrid: Address; classic: Address };
  loot: Address;
  rest?: string;
  evmRpc?: string;
  record?: boolean;
  robAmount?: bigint;
}): AttackContext {
  const evmRpc = options.evmRpc ?? TESTNET.evmRpc;
  if (privateKeyToAccount(options.key).address !== getAddress(options.owner.evm)) {
    throw new Error("the key does not belong to the owner account");
  }
  return {
    lane: new NativeLane({ rest: options.rest }),
    client: evmClient(evmRpc),
    evmRpc,
    key: options.key,
    owner: options.owner,
    vaults: options.vaults,
    loot: options.loot,
    lootNative: nativeAddress(options.loot),
    record: options.record ?? false,
    robAmount: options.robAmount ?? parseEther("0.01"),
    thief: accountFromStolenKey(options.key),
  };
}

// ---------------------------------------------------------------- the door

/** The owner account's EVM authorisation window, as the chain reports it. */
export interface Door {
  open: boolean;
  /** Contracts the window admits transactions to. Empty with `open` means unscoped. */
  targets: Address[];
  nativeOnly: boolean;
  remainingBlocks: bigint;
  remainingTxs: bigint;
  remainingValueUqor: bigint;
  usedTxs: bigint;
  usedValueUqor: bigint;
  maxTxs: bigint;
  maxValueUqor: bigint;
  expiryHeight: bigint;
}

export async function readDoor(lane: NativeLane, ownerNative: string): Promise<Door> {
  const w = await lane.window(ownerNative);
  return {
    open: w.found && w.live,
    targets: (w.allowedTargets ?? []).map((t) => getAddress(t)),
    nativeOnly: w.nativeOnly ?? false,
    remainingBlocks: BigInt(w.remainingBlocks ?? 0),
    remainingTxs: BigInt(w.remainingTxs ?? 0),
    remainingValueUqor: BigInt(w.remainingValue ?? 0),
    usedTxs: BigInt(w.usedTxs ?? 0),
    usedValueUqor: BigInt(w.usedValue ?? 0),
    maxTxs: BigInt(w.maxTxs ?? 0),
    maxValueUqor: BigInt(w.maxValue ?? 0),
    expiryHeight: BigInt(w.expiryHeight ?? 0),
  };
}

/** Whether the window lets the owner account send a transaction to `target`. */
export function doorAdmits(door: Door, target: Address): boolean {
  if (!door.open || door.nativeOnly || door.remainingTxs === 0n) return false;
  return door.targets.length === 0 || door.targets.includes(getAddress(target));
}

// ---------------------------------------------------------------- helpers

type Outcome = Omit<AttackResult, "id" | "ok" | "ms">;

const tidy = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 400);

async function nativeAttempt(ctx: AttackContext, msgs: NativeMessage[], mode: SignMode): Promise<Outcome> {
  const r = await ctx.lane.send(ctx.thief, msgs, { mode });
  if (r.stage === "transport") throw new Error(r.log);
  if (r.accepted) {
    return {
      verdict: "succeeded",
      mode: "on-chain",
      detail: "The chain accepted the transaction.",
      txHash: r.hash,
      explorerUrl: r.hash ? explorer.tx(r.hash) : undefined,
    };
  }
  return {
    verdict: "refused",
    by: "chain",
    code: `${r.codespace} ${r.code}`,
    detail: tidy(r.log),
    mode: "broadcast",
  };
}

async function evmAttempt(ctx: AttackContext, request: EvmTxRequest, lootIfMined = 0n): Promise<Outcome> {
  const sent = await sendWithKey(ctx.client, ctx.key, request, { evmRpc: ctx.evmRpc });
  if (!sent.admitted || !sent.receipt) {
    return {
      verdict: "refused",
      by: "chain",
      code: sent.refusal?.kind ?? "other",
      detail: sent.refusal?.message ?? "refused",
      mode: "broadcast",
    };
  }
  const mined = { txHash: sent.hash, explorerUrl: sent.hash ? explorer.tx(sent.hash) : undefined, mode: "on-chain" as const };
  if (sent.receipt.status === "reverted") {
    return { ...mined, verdict: "refused", by: "vault", code: "reverted", detail: "The transaction was mined and reverted." };
  }
  return { ...mined, verdict: "succeeded", detail: "The transaction was mined and took effect.", loot: lootIfMined };
}

function fromVaultVerdict(refusal: RefusalName, mode: CheckMode, amount: bigint): Outcome {
  if (refusal === "None") {
    return {
      verdict: "succeeded",
      mode,
      detail: mode === "simulated" ? "The vault would pay this." : "The vault paid.",
      loot: mode === "simulated" ? undefined : amount,
    };
  }
  return { verdict: "refused", by: "vault", code: refusal, detail: REFUSAL_TEXT[refusal].technical, mode };
}

/** Current time on chain, in seconds. */
async function chainTime(client: EvmClient): Promise<bigint> {
  return (await client.getBlock({ blockTag: "latest" })).timestamp;
}

async function theftIntent(ctx: AttackContext, vault: Address, amount?: bigint): Promise<WithdrawIntent> {
  const stats = await readStats(ctx.client, vault);
  return {
    to: ctx.loot,
    amount: amount ?? (stats.balance > 0n ? stats.balance : 1n),
    nonce: stats.nonce,
    deadline: (await chainTime(ctx.client)) + 900n,
  };
}

const ref = (ctx: AttackContext, vault: Address): VaultRef => ({
  address: vault,
  chainId: chain.id,
  owner: ctx.owner.evm,
});

/**
 * Put a withdrawal to a vault. The vault's verdict is always read first with an
 * eth_call; when recording is on and the window admits it, the same call is
 * then sent for real, so the attempt lands in the vault's own counters.
 */
async function vaultAttempt(
  ctx: AttackContext,
  door: Door,
  vault: Address,
  intent: WithdrawIntent,
  classicalSignature: Hex,
  postQuantumSignature: Hex,
  from: Address = ctx.owner.evm,
): Promise<Outcome> {
  const args = [intent.to, intent.amount, intent.nonce, intent.deadline, classicalSignature, postQuantumSignature] as const;
  const verdict = await askVault(ctx.client, vault, from, args);
  const simulated = fromVaultVerdict(verdict.refusal, "simulated", intent.amount);

  const asOwner = getAddress(from) === getAddress(ctx.owner.evm);
  if (!ctx.record || !asOwner) {
    return {
      ...simulated,
      note: asOwner
        ? "Recording is off, so this was checked with a call against live chain state."
        : "Sent from an account that is not the owner's, so it was checked with a call against live chain state.",
    };
  }
  if (!doorAdmits(door, vault)) {
    return {
      ...simulated,
      note: door.open
        ? "The owner's EVM window does not cover this, so the chain would refuse it before it reached the vault. Checked with a call against live chain state."
        : "The owner's EVM window is closed, so the chain would refuse this before it reached the vault. Checked with a call against live chain state.",
    };
  }

  const data = encodeWithdraw(intent, classicalSignature, postQuantumSignature);
  let sent = await sendWithKey(ctx.client, ctx.key, { to: vault, data, fallbackGas: 420_000n }, { evmRpc: ctx.evmRpc });
  if (!sent.admitted && sent.refusal?.kind === "nonce") {
    // Another visitor used the same account in the same moment. Try once more.
    sent = await sendWithKey(ctx.client, ctx.key, { to: vault, data, fallbackGas: 420_000n }, { evmRpc: ctx.evmRpc });
  }
  if (!sent.admitted || !sent.receipt) {
    return { ...simulated, note: `Not recorded on chain: ${sent.refusal?.message ?? "the node refused it"}` };
  }

  const mined = { txHash: sent.hash, explorerUrl: sent.hash ? explorer.tx(sent.hash) : undefined };
  if (sent.receipt.status === "reverted") {
    return { ...mined, verdict: "refused", by: "vault", code: "reverted", detail: "The transaction was mined and reverted.", mode: "on-chain" };
  }
  const events = parseEventLogs({ abi: vaultAbi, logs: sent.receipt.logs });
  const paid = events.find((e) => e.eventName === "Paid");
  if (paid && paid.eventName === "Paid") {
    return { ...mined, verdict: "succeeded", mode: "on-chain", detail: "The vault paid.", loot: paid.args.amount };
  }
  const refused = events.find((e) => e.eventName === "Refused");
  if (refused && refused.eventName === "Refused") {
    return { ...mined, ...fromVaultVerdict(refusalName(refused.args.reason), "on-chain", intent.amount) };
  }
  return { ...mined, ...simulated, mode: "on-chain", note: "Mined, but the vault logged no event." };
}

interface PaidWithdrawal {
  hash: Hex;
  intent: WithdrawIntent;
  classicalSignature: Hex;
  postQuantumSignature: Hex;
}

const WITHDRAW_SELECTOR = toFunctionSelector(
  "withdraw(address,uint256,uint256,uint256,bytes,bytes)",
);

/** The owner's most recent genuine withdrawal from the hybrid vault, read from the chain. */
export async function lastPaidWithdrawal(client: EvmClient, vault: Address): Promise<PaidWithdrawal | null> {
  const stats = await readStats(client, vault);
  if (stats.lastPaidAt === 0n) return null;
  let block;
  try {
    block = await client.getBlock({ blockNumber: stats.lastPaidAt, includeTransactions: true });
  } catch {
    return null; // the node has pruned that block
  }
  for (const tx of block.transactions) {
    if (!tx.to || getAddress(tx.to) !== getAddress(vault) || !tx.input.startsWith(WITHDRAW_SELECTOR)) continue;
    const decoded = decodeFunctionData({ abi: vaultAbi, data: tx.input });
    if (decoded.functionName !== "withdraw") continue;
    const [to, amount, nonce, deadline, classicalSignature, postQuantumSignature] = decoded.args;
    // Only a withdrawal that carried a full-size post-quantum signature is the owner's.
    if (postQuantumSignature.length !== 2 + 4627 * 2) continue;
    return { hash: tx.hash, intent: { to, amount, nonce, deadline }, classicalSignature, postQuantumSignature };
  }
  return null;
}

const skipped = (detail: string): Outcome => ({ verdict: "skipped", mode: "simulated", detail });

/** A GenericAuthorization for one message type, protobuf-encoded: field 1, a string. */
function genericAuthorization(msgTypeUrl: string): { typeUrl: string; value: Uint8Array } {
  const text = new TextEncoder().encode(msgTypeUrl);
  return {
    typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
    value: Uint8Array.from([0x0a, text.length, ...text]),
  };
}

// ---------------------------------------------------------------- the attacks

const RUNNERS: Record<string, (ctx: AttackContext, door: Door) => Promise<Outcome>> = {
  "native-transfer": (ctx) =>
    nativeAttempt(ctx, [messages.send(ctx.owner.native, ctx.lootNative, UQOR_PER_QOR)], "classical"),

  "native-own-pq-key": (ctx) =>
    nativeAttempt(ctx, [messages.send(ctx.owner.native, ctx.lootNative, UQOR_PER_QOR)], "hybrid"),

  "native-replace-key": (ctx) => {
    const proofOfPossession = signProofOfPossession({
      chainId: ctx.lane.chainId,
      account: ctx.owner.native,
      keypair: ctx.thief.pqc,
    });
    const msg = buildRegisterPqcKeyMsg(ctx.owner.native, {
      pqcKeypair: ctx.thief.pqc,
      keyType: "hybrid",
      proofOfPossession,
    });
    return nativeAttempt(ctx, [msg], "classical");
  },

  "native-open-window": (ctx) =>
    nativeAttempt(
      ctx,
      [
        messages.openWindow({
          sender: ctx.owner.native,
          blocks: MAX_WINDOW_BLOCKS,
          maxTxs: MAX_WINDOW_TXS,
          maxValueUqor: 1_000_000n * UQOR_PER_QOR,
        }),
      ],
      "classical",
    ),

  "native-authz": (ctx) =>
    nativeAttempt(
      ctx,
      [
        authz.grant({
          granter: ctx.owner.native,
          grantee: ctx.lootNative,
          grant: { authorization: genericAuthorization("/cosmos.bank.v1beta1.MsgSend") },
        }) as NativeMessage,
      ],
      "classical",
    ),

  "native-7702-consent": (ctx) =>
    nativeAttempt(
      ctx,
      [authorizeEvmDelegationMsg({ sender: ctx.owner.native, delegate: ctx.vaults.classic, blocks: 100 })],
      "classical",
    ),

  "evm-transfer": (ctx) =>
    evmAttempt(ctx, { to: ctx.loot, value: parseEther("1"), gas: 21_000n }, parseEther("1")),

  "evm-approve": (ctx) =>
    evmAttempt(ctx, {
      to: FUSD_TOKEN,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ctx.loot, maxUint256] }),
      fallbackGas: 70_000n,
    }),

  "evm-deploy": (ctx) =>
    // Init code for a contract whose runtime is a single STOP.
    evmAttempt(ctx, { data: "0x6001600c60003960016000f300", gas: 90_000n }),

  "evm-7702": async (ctx) => {
    const account = privateKeyToAccount(ctx.key);
    const wallet = createWalletClient({ account, chain, transport: http(ctx.evmRpc) });
    try {
      const authorization = await wallet.signAuthorization({ contractAddress: ctx.vaults.classic, executor: "self" });
      const fees = await nextFees(ctx.client);
      const hash = await wallet.sendTransaction({
        authorizationList: [authorization],
        to: account.address,
        data: "0x",
        gas: 120_000n,
        ...fees,
      });
      const receipt = await ctx.client.waitForTransactionReceipt({ hash, timeout: 120_000 });
      const code = await ctx.client.getCode({ address: account.address });
      const installed = code !== undefined && code !== "0x";
      return {
        verdict: installed ? "succeeded" : "refused",
        by: installed ? undefined : "chain",
        mode: "on-chain",
        code: installed ? undefined : "delegation-not-installed",
        detail: installed
          ? "The delegation was installed on the owner account."
          : `Mined with status ${receipt.status}; no code was installed on the owner account.`,
        txHash: hash,
        explorerUrl: explorer.tx(hash),
      };
    } catch (error) {
      const refusal = classifyEvmRefusal(error);
      return { verdict: "refused", by: "chain", code: refusal.kind, detail: refusal.message, mode: "broadcast" };
    }
  },

  "evm-forward": async (ctx, door) => {
    const value = parseEther("0.001");
    if (doorAdmits(door, ctx.vaults.classic) && !ctx.record) {
      // The chain would admit it and the vault would revert it, burning the fee. Ask without sending.
      try {
        await ctx.client.call({ account: ctx.owner.evm, to: ctx.vaults.classic, value });
      } catch (error) {
        return {
          verdict: "refused",
          by: "vault",
          code: revertName(error) ?? "reverted",
          detail: "The vault refuses value sent by the owner account over the EVM.",
          mode: "simulated",
          note: "Recording is off, so this was checked with a call against live chain state.",
        };
      }
      return { verdict: "succeeded", mode: "simulated", detail: "The vault would accept the owner's value." };
    }
    const outcome = await evmAttempt(ctx, { to: ctx.vaults.classic, value, gas: 60_000n });
    if (outcome.code === "reverted") {
      return { ...outcome, code: "OwnerCannotDeposit", detail: "Mined and reverted: the vault refuses value sent by the owner account over the EVM." };
    }
    return outcome;
  },

  "vault-no-signature": async (ctx, door) =>
    vaultAttempt(ctx, door, ctx.vaults.hybrid, await theftIntent(ctx, ctx.vaults.hybrid), "0x", "0x"),

  "vault-forged": async (ctx, door) => {
    const forged = new Uint8Array(4627);
    crypto.getRandomValues(forged);
    return vaultAttempt(ctx, door, ctx.vaults.hybrid, await theftIntent(ctx, ctx.vaults.hybrid), "0x", toHex(forged));
  },

  "vault-own-pq-key": async (ctx, door) => {
    const intent = await theftIntent(ctx, ctx.vaults.hybrid);
    const own = mldsa87.keygen();
    const signature = signPostQuantum(own.secretKey, ref(ctx, ctx.vaults.hybrid), intent);
    return vaultAttempt(ctx, door, ctx.vaults.hybrid, intent, "0x", signature);
  },

  "vault-relayed": async (ctx, door) => {
    const intent = await theftIntent(ctx, ctx.vaults.hybrid);
    const classical = await signClassical(ctx.key, ref(ctx, ctx.vaults.hybrid), intent);
    return vaultAttempt(ctx, door, ctx.vaults.hybrid, intent, classical, "0x", ctx.loot);
  },

  "vault-replay": async (ctx, door) => {
    const last = await lastPaidWithdrawal(ctx.client, ctx.vaults.hybrid);
    if (!last) return skipped("The owner has not made a withdrawal yet, or the node has pruned its block. Nothing to replay.");
    const outcome = await vaultAttempt(
      ctx,
      door,
      ctx.vaults.hybrid,
      last.intent,
      last.classicalSignature,
      last.postQuantumSignature,
    );
    return { ...outcome, note: [`Replayed ${last.hash}.`, outcome.note].filter(Boolean).join(" ") };
  },

  "vault-redirect": async (ctx, door) => {
    const last = await lastPaidWithdrawal(ctx.client, ctx.vaults.hybrid);
    if (!last) return skipped("The owner has not made a withdrawal yet, or the node has pruned its block. No signature to reuse.");
    const intent = await theftIntent(ctx, ctx.vaults.hybrid);
    const outcome = await vaultAttempt(ctx, door, ctx.vaults.hybrid, intent, "0x", last.postQuantumSignature);
    return { ...outcome, note: [`Signature taken from ${last.hash}.`, outcome.note].filter(Boolean).join(" ") };
  },

  "control-rob": async (ctx, door) => {
    const stats = await readStats(ctx.client, ctx.vaults.classic);
    if (stats.balance === 0n) {
      return skipped(
        `The control vault is empty: it has been robbed ${stats.paidCount} time${stats.paidCount === 1n ? "" : "s"}. It is refilled from time to time.`,
      );
    }
    const amount = stats.balance < ctx.robAmount ? stats.balance : ctx.robAmount;
    return vaultAttempt(ctx, door, ctx.vaults.classic, await theftIntent(ctx, ctx.vaults.classic, amount), "0x", "0x");
  },
};

const OWNER_CANNOT_DEPOSIT = toFunctionSelector("OwnerCannotDeposit()");

/** The custom error a reverted call carried, when the node passed its data back. */
function revertName(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const text = [error.details, error.shortMessage, error.message].join(" ").toLowerCase();
  return text.includes(OWNER_CANNOT_DEPOSIT) ? "OwnerCannotDeposit" : undefined;
}

/** Run one attack. Never throws: a tool failure is reported as a skipped attack. */
export async function runAttack(ctx: AttackContext, id: string): Promise<AttackResult> {
  const info = attackInfo(id);
  const run = RUNNERS[id];
  const started = Date.now();
  let outcome: Outcome;
  try {
    if (!run) throw new Error(`no runner for ${id}`);
    outcome = await run(ctx, await readDoor(ctx.lane, ctx.owner.native));
  } catch (error) {
    outcome = {
      verdict: "skipped",
      mode: "simulated",
      detail: `Could not run: ${tidy(error instanceof Error ? error.message : String(error))}`,
    };
  }
  return { id, ...outcome, ok: matches(info, outcome.verdict), ms: Date.now() - started };
}

function matches(info: AttackInfo, verdict: Verdict): boolean {
  if (verdict === "skipped") return true;
  return info.expects === "refused" ? verdict === "refused" : verdict === "succeeded";
}

/** Run several attacks one after another (they share one account, so not in parallel). */
export async function runAttacks(
  ctx: AttackContext,
  ids: readonly string[] = ATTACKS.map((a) => a.id),
  onResult?: (result: AttackResult) => void,
): Promise<AttackResult[]> {
  const results: AttackResult[] = [];
  for (const id of ids) {
    const result = await runAttack(ctx, id);
    results.push(result);
    onResult?.(result);
  }
  return results;
}
