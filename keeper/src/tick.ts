/**
 * One keeper tick: read the chain, decide, act. Run it on a schedule.
 *
 *   npm run keeper                 act
 *   npm run keeper -- --dry        read and decide, change nothing
 *   npm run keeper -- --close      close the owner's window and stop (for maintenance)
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
import { NativeLane, accountFromMnemonic, messages, type UnifiedAccount } from "@stv/core/native";
import { requireSecret } from "@stv/core/node";
import { formatEther, formatUnits, parseEther, type Hex } from "viem";
import { CONTROL_REFILL_TO_UQOR, WINDOW, plan, type Action, type Reading } from "./plan";

const dry = process.argv.includes("--dry");
const closeOnly = process.argv.includes("--close");

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

async function ensurePayerWindow(payer: UnifiedAccount) {
  const door = await readDoor(lane, payer.cosmos);
  if (door.open && door.remainingTxs >= 2n && door.remainingBlocks > 200n) return;
  await must(
    "payer window",
    await lane.send(payer, [
      messages.openWindow({ sender: payer.cosmos, blocks: 17_000n, maxTxs: 40n, maxValueUqor: 2_000_000n, allowedTargets: [vaults.hybrid] }),
    ]),
  );
}

async function refillControl(owner: UnifiedAccount) {
  await must(
    `refill control vault to ${formatUnits(CONTROL_REFILL_TO_UQOR, 6)} QOR`,
    await lane.send(owner, [messages.send(owner.cosmos, deployment.vaults.classic.native, CONTROL_REFILL_TO_UQOR)]),
  );
}

async function act(action: Action, owner: UnifiedAccount, payer: UnifiedAccount) {
  log(`${action.kind}: ${action.reason}`);
  if (dry) return;
  switch (action.kind) {
    case "open-window":
      return openWindow(owner);
    case "proof-of-life":
      await ensurePayerWindow(payer);
      return proofOfLife(owner, payer);
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

  if (closeOnly) {
    if (!dry) await must("close window", await lane.send(owner, [messages.closeWindow(owner.cosmos)]));
    return;
  }

  const reading = await read(owner);
  log(
    `window ${reading.door.open ? "open" : "closed"}, ${reading.door.remainingTxs} txs / ${reading.door.remainingBlocks} blocks / ${formatUnits(reading.door.remainingValueUqor, 6)} QOR left; ` +
      `hybrid ${formatEther(reading.hybridBalanceWei)} QOR, control ${formatEther(reading.controlBalanceWei)} QOR, owner liquid ${formatUnits(reading.ownerLiquidUqor, 6)} QOR, ` +
      `last paid at block ${reading.lastPaidAt}, now ${reading.currentBlock}`,
  );
  const actions = plan(reading);
  if (actions.length === 0) log("nothing to do");
  for (const action of actions) await act(action, owner, payer);
}

main().catch((error: unknown) => {
  log(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
