/**
 * status: what the chain says right now about the owner account and both vaults.
 *
 * Read-only and needs nothing secret.
 *
 *   npm run status            text
 *   npm run status -- --json  machine-readable
 */
import { deployment, evmClient, readStats, type VaultStats } from "@stv/core";
import { readDoor } from "@stv/core/attacks";
import { NativeLane } from "@stv/core/native";
import type { Address } from "viem";
import { c, formatStatus, jsonReplacer, statusProblems, type StatusReport, type VaultReport } from "./format";

function report(label: string, address: Address, postQuantum: boolean, s: VaultStats): VaultReport {
  return {
    label,
    address,
    postQuantum,
    balance: s.balance,
    paidCount: s.paidCount,
    paidTotal: s.paidTotal,
    refusedCount: s.refusedCount,
    keyholderRefusedCount: s.keyholderRefusedCount,
    counterfactualThefts: s.counterfactualThefts,
    counterfactualLoss: s.counterfactualLoss,
    lastPaidAt: s.lastPaidAt,
    lastRefusedAt: s.lastRefusedAt,
    refusedBy: s.refusedBy,
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const unknown = args.filter((a) => a !== "--json");
  if (unknown.length > 0) {
    console.error(`unknown option ${unknown[0]}\n\n  npm run status            text\n  npm run status -- --json  machine-readable`);
    return 2;
  }

  const client = evmClient();
  const lane = new NativeLane();
  const { owner, vaults } = deployment;

  const [block, hybrid, classic, door, liquidUqor, pqc] = await Promise.all([
    client.getBlockNumber(),
    readStats(client, vaults.hybrid.address),
    readStats(client, vaults.classic.address),
    readDoor(lane, owner.native),
    lane.balance(owner.native),
    lane.pqcStatus(owner.native),
  ]);

  const status: StatusReport = {
    network: deployment.network,
    evmChainId: deployment.evmChainId,
    block,
    owner: {
      ...owner,
      liquidUqor,
      pqcRegistered: pqc.registered,
      possessionProven: pqc.possessionProven === true,
    },
    door,
    vaults: [
      report("hybrid vault ", vaults.hybrid.address, true, hybrid),
      report("control vault", vaults.classic.address, false, classic),
    ],
  };
  const problems = statusProblems(status);

  if (json) {
    console.log(JSON.stringify({ ...status, problems }, jsonReplacer, 2));
  } else {
    console.log(formatStatus(status));
    console.log();
    if (problems.length === 0) console.log(c.green("No problems."));
    for (const p of problems) console.log(c.red(`PROBLEM: ${p}`));
  }
  return problems.length === 0 ? 0 : 1;
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
