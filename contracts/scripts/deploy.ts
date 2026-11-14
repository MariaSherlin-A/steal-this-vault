/**
 * Deploys the two vaults to QoreChain testnet and funds them.
 *
 *   npm run deploy -w contracts              deploy both vaults, write deployments/testnet.json
 *   npm run deploy -w contracts -- --dry     show what would happen and the balances
 *
 * The contracts are deployed by a separate deployer account. The vault owner's
 * secp256k1 key is public, so the owner account must never hold an unscoped EVM
 * window, and a deployment needs one (scoped windows refuse contract creation).
 *
 * Funding goes over the native lane, signed with both of the owner's keys.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TESTNET, UQOR_PER_QOR, evmClient, sendWithKey, vaultAbi } from "@stv/core";
import {
  NativeLane,
  accountFromMnemonic,
  ensurePqcKeyRegistered,
  messages,
  nativeAddress,
  newMnemonic,
  windowCostUqor,
  type UnifiedAccount,
} from "@stv/core/native";
import { repoRoot, requireSecret, saveSecret, secret } from "@stv/core/node";
import { encodeDeployData, formatUnits, getAddress, type Address, type Hex } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes("--dry");

/** What the owner sends each account, in uqor. */
const DEPLOYER_FUNDS = 8n * UQOR_PER_QOR;
const HYBRID_VAULT_FUNDS = 10n * UQOR_PER_QOR;
const CLASSIC_VAULT_FUNDS = UQOR_PER_QOR / 20n; // 0.05 QOR of bait

const qor = (uqor: bigint) => `${formatUnits(uqor, 6)} QOR`;
const lane = new NativeLane();
const client = evmClient();

function artifact(name: string): { abi: unknown[]; bytecode: Hex; compiler: string } {
  return JSON.parse(readFileSync(join(here, "../artifacts", `${name}.json`), "utf8")) as {
    abi: unknown[];
    bytecode: Hex;
    compiler: string;
  };
}

async function must(label: string, result: Awaited<ReturnType<NativeLane["send"]>>): Promise<void> {
  if (!result.accepted) throw new Error(`${label} failed at ${result.stage}: code ${result.code} ${result.log}`);
  console.log(`  ${label}: ${result.hash} (block ${result.height})`);
}

async function deployVault(deployer: UnifiedAccount, owner: Address, postQuantum: boolean) {
  const data = encodeDeployData({ abi: vaultAbi, bytecode: artifact("Vault").bytecode, args: [owner, postQuantum] });
  const sent = await sendWithKey(client, deployer.privateKey as Hex, { data, fallbackGas: 2_600_000n });
  if (!sent.admitted || !sent.receipt) throw new Error(`deployment refused: ${sent.refusal?.message}`);
  if (sent.receipt.status !== "success" || !sent.receipt.contractAddress) throw new Error("deployment reverted");
  const address = getAddress(sent.receipt.contractAddress);
  console.log(
    `  Vault(postQuantum=${postQuantum}) at ${address}, gas ${sent.receipt.gasUsed}, tx ${sent.hash}, block ${sent.receipt.blockNumber}`,
  );
  return { address, native: nativeAddress(address), postQuantum, deployTx: sent.hash!, deployBlock: Number(sent.receipt.blockNumber) };
}

async function main() {
  const owner = await accountFromMnemonic(requireSecret("VAULT_MNEMONIC"));

  if (!secret("DEPLOYER_MNEMONIC")) {
    if (dry) throw new Error("DEPLOYER_MNEMONIC is not set; a real run creates it");
    saveSecret("DEPLOYER_MNEMONIC", newMnemonic());
    console.log("created DEPLOYER_MNEMONIC in .env");
  }
  const deployer = await accountFromMnemonic(requireSecret("DEPLOYER_MNEMONIC"));

  console.log(`owner     ${owner.evm}  ${owner.cosmos}  ${qor(await lane.balance(owner.cosmos))}`);
  console.log(`deployer  ${deployer.evm}  ${deployer.cosmos}  ${qor(await lane.balance(deployer.cosmos))}`);

  const ownerKey = await lane.pqcStatus(owner.cosmos);
  if (!ownerKey.registered || !ownerKey.possessionProven) {
    throw new Error("the owner has no post-quantum key with proof of possession on record; run spikes/01 first");
  }
  if (dry) return;

  console.log("\n1. fund the deployer and register its post-quantum key");
  if ((await lane.balance(deployer.cosmos)) < DEPLOYER_FUNDS / 2n) {
    await must("owner -> deployer", await lane.send(owner, [messages.send(owner.cosmos, deployer.cosmos, DEPLOYER_FUNDS)]));
  }
  const registered = await ensurePqcKeyRegistered(lane, deployer);
  if (registered !== "already") await must("register key", registered);

  console.log("\n2. open an EVM window on the deployer (unscoped: deployments need one)");
  const fees = { gas: 2_600_000n, maxFeePerGas: 130_000_000_000n };
  await must(
    "open window",
    await lane.send(deployer, [
      messages.openWindow({
        sender: deployer.cosmos,
        blocks: 300n,
        maxTxs: 4n,
        maxValueUqor: windowCostUqor(fees) * 4n,
      }),
    ]),
  );

  console.log("\n3. deploy");
  const hybrid = await deployVault(deployer, getAddress(owner.evm), true);
  const classic = await deployVault(deployer, getAddress(owner.evm), false);

  console.log("\n4. close the deployer's window");
  await must("close window", await lane.send(deployer, [messages.closeWindow(deployer.cosmos)]));

  console.log("\n5. fund the vaults from the owner, over the native lane (both keys sign)");
  await must(
    `owner -> hybrid vault ${qor(HYBRID_VAULT_FUNDS)}`,
    await lane.send(owner, [messages.send(owner.cosmos, hybrid.native, HYBRID_VAULT_FUNDS)]),
  );
  await must(
    `owner -> classic vault ${qor(CLASSIC_VAULT_FUNDS)}`,
    await lane.send(owner, [messages.send(owner.cosmos, classic.native, CLASSIC_VAULT_FUNDS)]),
  );

  const deployment = {
    network: TESTNET.nativeChainId,
    evmChainId: TESTNET.evmChainId,
    owner: { evm: getAddress(owner.evm), native: owner.cosmos },
    deployer: { evm: getAddress(deployer.evm), native: deployer.cosmos },
    vaults: { hybrid, classic },
    compiler: artifact("Vault").compiler,
    deployedAt: new Date().toISOString(),
  };
  const file = join(repoRoot(), "deployments", "testnet.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`\nwrote ${file}`);

  for (const [name, vault] of Object.entries(deployment.vaults)) {
    const balance = await client.getBalance({ address: vault.address });
    console.log(`  ${name}: ${formatUnits(balance, 18)} QOR`);
  }
  console.log(`owner     ${qor(await lane.balance(owner.cosmos))}`);
  console.log(`deployer  ${qor(await lane.balance(deployer.cosmos))}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
