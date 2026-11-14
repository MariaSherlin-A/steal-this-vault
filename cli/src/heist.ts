/**
 * heist: run every attack against the live vaults.
 *
 * Needs nothing secret. The only key it uses is the published one.
 */
import { ATTACKS, GROUPS, PUBLISHED_KEY, deployment, evmClient, readStats, type AttackGroup } from "@stv/core";
import { createAttackContext, readDoor, runAttack, type AttackResult } from "@stv/core/attacks";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { USAGE, c, describeDoor, formatResult, jsonReplacer, listAttacks, parseArgs, qor, summarise } from "./format";

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.list) {
    console.log(listAttacks());
    return 0;
  }

  // Loot goes to a throwaway wallet unless the user names one.
  const lootKey = options.loot ? undefined : generatePrivateKey();
  const loot = options.loot ?? privateKeyToAccount(lootKey!).address;

  const ctx = createAttackContext({
    key: options.key ?? PUBLISHED_KEY,
    owner: deployment.owner,
    vaults: { hybrid: deployment.vaults.hybrid.address, classic: deployment.vaults.classic.address },
    loot,
    rest: options.rest,
    evmRpc: options.evmRpc,
    record: options.record,
  });
  const client = evmClient(options.evmRpc);
  const say = (line = "") => {
    if (!options.json) console.log(line);
  };

  const [hybridBefore, classicBefore, door, ownerBefore] = await Promise.all([
    readStats(client, ctx.vaults.hybrid),
    readStats(client, ctx.vaults.classic),
    readDoor(ctx.lane, ctx.owner.native),
    ctx.lane.balance(ctx.owner.native),
  ]);

  say(c.bold("Steal This Vault: heist"));
  say(`network        ${deployment.network} (EVM chain ${deployment.evmChainId})`);
  say(`owner account  ${ctx.owner.evm}  (its secp256k1 key is public)`);
  say(`hybrid vault   ${ctx.vaults.hybrid}  holds ${qor(hybridBefore.balance)}`);
  say(`control vault  ${ctx.vaults.classic}  holds ${qor(classicBefore.balance)}`);
  say(`EVM window     ${describeDoor(door)}`);
  say(`loot wallet    ${loot}`);
  say(
    options.record
      ? "recording      on: vault-level attempts are sent on chain while the window admits them"
      : "recording      off: vault-level attempts are checked by eth_call against live state",
  );

  const ids = options.only ?? ATTACKS.map((a) => a.id);
  const results: AttackResult[] = [];
  for (const group of Object.keys(GROUPS) as AttackGroup[]) {
    const inGroup = ids.filter((id) => ATTACKS.find((a) => a.id === id)?.group === group);
    if (inGroup.length === 0) continue;
    say();
    say(c.bold(GROUPS[group].title));
    for (const id of inGroup) {
      const result = await runAttack(ctx, id);
      results.push(result);
      say(formatResult(result));
    }
  }

  const [hybridAfter, classicAfter, ownerAfter] = await Promise.all([
    readStats(client, ctx.vaults.hybrid),
    readStats(client, ctx.vaults.classic),
    ctx.lane.balance(ctx.owner.native),
  ]);
  const summary = summarise(results);
  const hybridIntact = hybridAfter.balance >= hybridBefore.balance;
  const stolen = results.reduce((sum, r) => sum + (r.loot ?? 0n), 0n);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          network: deployment.network,
          vaults: ctx.vaults,
          recorded: options.record,
          results,
          summary,
          hybridVault: { before: hybridBefore.balance, after: hybridAfter.balance, intact: hybridIntact },
          controlVault: { before: classicBefore.balance, after: classicAfter.balance },
          ownerLiquidUqor: { before: ownerBefore, after: ownerAfter },
        },
        jsonReplacer,
        2,
      ),
    );
  } else {
    say();
    say(c.bold("Result"));
    say(`  ${summary.refused} refused, ${summary.robbed} robbed (the control), ${summary.skipped} skipped, of ${summary.total}`);
    say(`  hybrid vault   ${qor(hybridBefore.balance)} before, ${qor(hybridAfter.balance)} after  ${hybridIntact ? c.green("untouched") : c.red("LOST FUNDS")}`);
    say(`  control vault  ${qor(classicBefore.balance)} before, ${qor(classicAfter.balance)} after`);
    say(`  owner account  ${Number(ownerBefore) / 1e6} QOR liquid before, ${Number(ownerAfter) / 1e6} after (fees for recorded attempts)`);
    say(`  vault's own count of refused attempts: ${hybridBefore.refusedCount} before, ${hybridAfter.refusedCount} after`);
    if (stolen > 0n && lootKey) {
      say();
      say(`  The control vault paid ${qor(stolen)} to ${loot}.`);
      say(`  That wallet's key, if you want the test coins: ${lootKey}`);
    }
    say();
    say(
      summary.unexpected === 0 && hybridIntact
        ? c.green("  Every attack ended as expected.")
        : c.red(`  ${summary.unexpected} attack(s) did NOT end as expected. This is a finding: please report it.`),
    );
  }
  return summary.unexpected === 0 && hybridIntact ? 0 : 1;
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
