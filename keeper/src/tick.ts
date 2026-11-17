/**
 * One keeper tick: read the chain, decide, act. Run it on a schedule.
 *
 *   npm run keeper                 act
 *   npm run keeper -- --dry        read and decide, change nothing
 *   npm run keeper -- --close      close the owner's window and stop (for maintenance)
 *   npm run keeper -- --drill      drill mode (or KEEPER_MODE=drill): window shut, control vault emptied
 *   npm run keeper -- --proof-tx   one normal payment from the owner account, signed with both keys
 *   npm run keeper -- --rescue <0x…>  the way out: shut the side door and move everything in the two-lock vault to a fresh account
 *
 * This is the only process that holds the owner's mnemonic. It signs three
 * kinds of transaction, all on the native lane with both keys:
 *   - MsgOpenEVMWindow scoped to the two vaults
 *   - a proof-of-life withdrawal: the owner, with both keys, takes a little
 *     from the hybrid vault, so the vault is seen to work for its owner
 *   - a top-up of the control vault after it has been robbed
 *
 * The proof-of-life withdrawal is submitted over the EVM from a separate payer
 * account, never from the owner account. Anyone may submit a signed intent, and
 * using the owner account would spend the window's fee budget.
 */
import { deployment, evmClient, readStats, sendWithKey, signWithdrawal, vaultRef, explorer } from "@stv/core";
import { readDoor } from "@stv/core/attacks";
import { NativeLane, accountFromMnemonic, messages, nativeAddress, type UnifiedAccount } from "@stv/core/native";
import { requireSecret } from "@stv/core/node";
import { encodeWithdraw } from "@stv/core/intent";
import { formatEther, formatUnits, parseEther, type Hex } from "viem";
import { doorAdmits } from "@stv/core/attacks";
import type { Address } from "viem";
import { CONTROL_REFILL_TO_UQOR, WINDOW, inDrillPeriod, modeFrom, plan, rescueProblems, type Action, type Reading } from "./plan";

const dry = process.argv.includes("--dry");
const closeOnly = process.argv.includes("--close");
const proofTx = process.argv.includes("--proof-tx");
const rescueTo = process.argv.includes("--rescue") ? (process.argv[process.argv.indexOf("--rescue") + 1] ?? "") : null;
const mode = modeFrom(process.argv, process.env.KEEPER_MODE);

/** The drill's proof that the project still works: the owner adds 0.01 QOR to the hybrid vault, signed with both keys. */
const PROOF_TX_UQOR = 10_000n;

/** What proof of life takes from the hybrid vault each day. */
const PROOF_OF_LIFE_WEI = parseEther("0.001");

const lane = new NativeLane();
const client = evmClient();
const vaults = { hybrid: deployment.vaults.hybrid.address, classic: deployment.vaults.classic.address };
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

async function must(label: string, result: Awaited<ReturnType<NativeLane["send"]>>) {
  if (!result.accepted) throw new Error(`${label} failed at ${result.stage}: code ${result.code} ${result.log}`);
  log(`${label}: ${result.hash} (block ${result.height})`);
}

async function read(owner: UnifiedAccount): Promise<Reading> {
  const [door, hybrid, classic, currentBlock, ownerLiquidUqor] = await Promise.all([
    readDoor(lane, owner.cosmos),
    readStats(client, vaults.hybrid),
    readStats(client, vaults.classic),
    client.getBlockNumber(),
    lane.balance(owner.cosmos),
  ]);
  return {
    door,
    vaults,
    currentBlock,
    lastPaidAt: hybrid.lastPaidAt,
    hybridBalanceWei: hybrid.balance,
    controlBalanceWei: classic.balance,
    ownerLiquidUqor,
  };
}

async function openWindow(owner: UnifiedAccount) {
  await must(
    "open window",
    await lane.send(owner, [
      messages.openWindow({
        sender: owner.cosmos,
        blocks: WINDOW.blocks,
        maxTxs: WINDOW.maxTxs,
        maxValueUqor: WINDOW.maxValueUqor,
        allowedTargets: [vaults.hybrid, vaults.classic],
      }),
    ]),
  );
}

async function proofOfLife(owner: UnifiedAccount, payer: UnifiedAccount) {
  const stats = await readStats(client, vaults.hybrid);
  const intent = {
    to: payer.evm as `0x${string}`,
    amount: stats.balance < PROOF_OF_LIFE_WEI ? stats.balance : PROOF_OF_LIFE_WEI,
    nonce: stats.nonce,
    deadline: (await client.getBlock()).timestamp + 1800n,
  };
  const signed = await signWithdrawal(
    { privateKey: owner.privateKey as Hex, pqSecretKey: owner.pqc.secretKey },
    vaultRef("hybrid"),
    intent,
  );
  const sent = await sendWithKey(client, payer.privateKey as Hex, { to: vaults.hybrid, data: signed.calldata, fallbackGas: 420_000n });
  if (!sent.admitted || sent.receipt?.status !== "success") {
    throw new Error(`proof of life not mined: ${sent.refusal?.message ?? sent.receipt?.status}`);
  }
  const after = await readStats(client, vaults.hybrid);
  if (after.nonce !== intent.nonce + 1n) throw new Error("proof of life was refused by the vault");
  log(`proof of life: withdrew ${formatEther(intent.amount)} QOR, tx ${sent.hash} ${explorer.tx(sent.hash!)}`);
}

async function ensurePayerWindow(payer: UnifiedAccount, target: Address) {
  const door = await readDoor(lane, payer.cosmos);
  if (doorAdmits(door, target) && door.remainingTxs >= 2n && door.remainingBlocks > 200n) return;
  await must(
    "payer window",
    await lane.send(payer, [
      messages.openWindow({
        sender: payer.cosmos,
        blocks: 17_000n,
        maxTxs: 40n,
        maxValueUqor: 2_000_000n,
        allowedTargets: [vaults.hybrid, vaults.classic],
      }),
    ]),
  );
}

/**
 * Take everything out of the one-lock vault, back to the owner. The owner account
 * calls the vault itself, inside its window, exactly as the `control-rob` attack
 * does. A relayed EIP-712 signature is not used: on this testnet the ecrecover
 * precompile returned nothing for accounts with a registered ML-DSA-87 key while
 * their window was shut (seen 14 Nov 2026).
 */
async function emptyControl(owner: UnifiedAccount) {
  const stats = await readStats(client, vaults.classic);
  if (stats.balance === 0n) return log("control vault already empty");
  const intent = {
    to: owner.evm as `0x${string}`,
    amount: stats.balance,
    nonce: stats.nonce,
    deadline: (await client.getBlock()).timestamp + 1800n,
  };
  const sent = await sendWithKey(client, owner.privateKey as Hex, { to: vaults.classic, data: encodeWithdraw(intent), fallbackGas: 120_000n });
  if (!sent.admitted || sent.receipt?.status !== "success") {
    throw new Error(`emptying the control vault was not mined: ${sent.refusal?.message ?? sent.receipt?.status}`);
  }
  const after = await readStats(client, vaults.classic);
  if (after.balance !== 0n) throw new Error(`the control vault still holds ${after.balance} wei`);
  log(`emptied the control vault: ${formatEther(intent.amount)} QOR back to the owner, tx ${sent.hash} ${explorer.tx(sent.hash!)}`);
}

async function sendProofTx(owner: UnifiedAccount) {
  const result = await lane.send(owner, [messages.send(owner.cosmos, deployment.vaults.hybrid.native, PROOF_TX_UQOR)]);
  await must(`proof transaction: the owner added ${formatUnits(PROOF_TX_UQOR, 6)} QOR to the hybrid vault, signed with both keys`, result);
  log(`submit this hash on the project page: ${result.hash}`);
}

async function refillControl(owner: UnifiedAccount) {
  await must(
    `refill control vault to ${formatUnits(CONTROL_REFILL_TO_UQOR, 6)} QOR`,
    await lane.send(owner, [messages.send(owner.cosmos, deployment.vaults.classic.native, CONTROL_REFILL_TO_UQOR)]),
  );
}


/**
 * The way out. When the owner fears the leaked key is about to be joined by a
 * leaked second key, or simply wants the money somewhere the public key has
 * never been: shut the owner's side door, then move everything in the two-lock
 * vault to a fresh account that has its own second lock. The withdrawal is
 * signed with both of the owner's keys and relayed by the payer, exactly like
 * proof of life, so the owner account's window is not needed and stays shut.
 */
async function rescue(owner: UnifiedAccount, payer: UnifiedAccount, target: string) {
  const [stats, pqc] = await Promise.all([readStats(client, vaults.hybrid), target.startsWith("0x") && target.length === 42 ? lane.pqcStatus(nativeAddress(target as Address)) : null]);
  const problems = rescueProblems({
    target,
    owner: owner.evm as Address,
    deployer: payer.evm as Address,
    vaults,
    targetHasSecondLock: pqc?.registered === true,
    hybridBalanceWei: stats.balance,
  });
  if (problems.length > 0) throw new Error(`rescue refused:\n  - ${problems.join("\n  - ")}`);
  const to = target as Address;
  log(`rescue: move ${formatEther(stats.balance)} QOR from the two-lock vault to ${to}, which has its own second lock`);
  if (dry) return log("dry run: nothing moved");

  const door = await readDoor(lane, owner.cosmos);
  if (door.open) await must("shut the owner's side door", await lane.send(owner, [messages.closeWindow(owner.cosmos)]));
  else log("the owner's side door is already shut");

  await ensurePayerWindow(payer, vaults.hybrid);
  const intent = { to, amount: stats.balance, nonce: stats.nonce, deadline: (await client.getBlock()).timestamp + 1800n };
  const signed = await signWithdrawal({ privateKey: owner.privateKey as Hex, pqSecretKey: owner.pqc.secretKey }, vaultRef("hybrid"), intent);
  const sent = await sendWithKey(client, payer.privateKey as Hex, { to: vaults.hybrid, data: signed.calldata, fallbackGas: 420_000n });
  if (!sent.admitted || sent.receipt?.status !== "success") throw new Error(`rescue not mined: ${sent.refusal?.message ?? sent.receipt?.status}`);
  const after = await readStats(client, vaults.hybrid);
  if (after.balance !== 0n) throw new Error(`the two-lock vault still holds ${formatEther(after.balance)} QOR`);
  log(`rescued ${formatEther(intent.amount)} QOR to ${to}, tx ${sent.hash} ${explorer.tx(sent.hash!)}`);
  log("the vault is empty and the side door is shut. The keeper will reopen the door on its next tick; stop the keeper workflow if that is not wanted.");
}

async function act(action: Action, owner: UnifiedAccount, payer: UnifiedAccount) {
  log(`${action.kind}: ${action.reason}`);
  if (dry) return;
  switch (action.kind) {
    case "open-window":
      return openWindow(owner);
    case "proof-of-life":
      await ensurePayerWindow(payer, vaults.hybrid);
      return proofOfLife(owner, payer);
    case "close-window":
      return must("close window", await lane.send(owner, [messages.closeWindow(owner.cosmos)]));
    case "empty-control":
      return emptyControl(owner);
    case "refill-control":
      return refillControl(owner);
    case "stop":
      process.exitCode = 1;
  }
}

async function main() {
  const owner = await accountFromMnemonic(requireSecret("VAULT_MNEMONIC"));
  // The deployer doubles as the payer: it holds a little QOR and has a PQC key.
  const payer = await accountFromMnemonic(requireSecret("DEPLOYER_MNEMONIC"));

  if (proofTx) {
    if (!inDrillPeriod(new Date())) log("note: this is not drill day (18 Nov 2026 UTC); a proof made now is a rehearsal and will not count");
    if (!dry) await sendProofTx(owner);
    return;
  }

  if (rescueTo !== null) {
    await rescue(owner, payer, rescueTo);
    return;
  }

  if (closeOnly) {
    if (!dry) await must("close window", await lane.send(owner, [messages.closeWindow(owner.cosmos)]));
    return;
  }

  const reading = await read(owner);
  log(`mode ${mode}${inDrillPeriod(new Date()) && !process.argv.includes("--normal") ? " (drill period: forced, KEEPER_MODE ignored)" : ""}`);
  log(
    `window ${reading.door.open ? "open" : "closed"}, ${reading.door.remainingTxs} txs / ${reading.door.remainingBlocks} blocks / ${formatUnits(reading.door.remainingValueUqor, 6)} QOR left; ` +
      `hybrid ${formatEther(reading.hybridBalanceWei)} QOR, control ${formatEther(reading.controlBalanceWei)} QOR, owner liquid ${formatUnits(reading.ownerLiquidUqor, 6)} QOR, ` +
      `last paid at block ${reading.lastPaidAt}, now ${reading.currentBlock}`,
  );
  const actions = plan(reading, mode);
  if (actions.length === 0) log("nothing to do");
  for (const action of actions) await act(action, owner, payer);
}

main().catch((error: unknown) => {
  log(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
