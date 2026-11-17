/**
 * intruders: every wallet that came for the vault money, built from the vaults'
 * event logs, with the money trail of each one followed on the native lane.
 *
 * Read-only and needs nothing secret.
 *
 *   npm run intruders            text
 *   npm run intruders -- --json  machine-readable
 */
import { deployment, evmClient } from "@stv/core";
import { intruderFile, readHistory, type KnownAccounts } from "@stv/core/history";
import { NativeLane, nativeAddress } from "@stv/core/native";
import { EVM_MODULE_ACCOUNT, followMoney, type Trail } from "@stv/core/trail";
import { formatIntruders, jsonReplacer, type IntruderReport } from "./format";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const unknown = args.filter((a) => a !== "--json");
  if (unknown.length > 0) {
    console.error(`unknown option ${unknown[0]}\n\n  npm run intruders            text\n  npm run intruders -- --json  machine-readable`);
    return 2;
  }

  const client = evmClient();
  const lane = new NativeLane();
  const { owner, deployer, vaults } = deployment;
  const known: KnownAccounts = { owner: owner.evm, deployer: deployer.evm, hybrid: vaults.hybrid.address, classic: vaults.classic.address };
  const knownNative: Record<string, string> = {
    [owner.native]: "the owner's own account",
    [deployer.native]: "the project's own test account",
    [nativeAddress(vaults.hybrid.address)]: "the two-lock vault",
    [nativeAddress(vaults.classic.address)]: "the one-lock vault",
    [EVM_MODULE_ACCOUNT]: "a contract payout, the way the chain records a vault paying out",
  };

  const block = await client.getBlockNumber();
  const [hybrid, classic] = await Promise.all([
    readHistory(client, vaults.hybrid.address, BigInt(vaults.hybrid.deployBlock), block),
    readHistory(client, vaults.classic.address, BigInt(vaults.classic.deployBlock), block),
  ]);
  const file = intruderFile([...hybrid, ...classic], known);

  const trails: Record<string, Trail> = {};
  for (const intruder of file.intruders) {
    if (intruder.label !== null) continue; // the project's own accounts need no investigation
    try {
      trails[intruder.address.toLowerCase()] = await followMoney(lane, nativeAddress(intruder.address), { sinceHeight: intruder.firstBlock });
    } catch (error) {
      if (!json) console.error(`could not follow ${intruder.address}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const report: IntruderReport = { block, file, trails, knownNative };
  if (json) console.log(JSON.stringify(report, jsonReplacer, 2));
  else console.log(formatIntruders(report));
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  },
);
