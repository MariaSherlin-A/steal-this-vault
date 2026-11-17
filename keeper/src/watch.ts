/**
 * watch: tell the owner the moment the leaked key is used.
 *
 *   npm run watch                    keep watching, a message per new attempt
 *   npm run watch -- --once          one look, then stop (for a scheduled job)
 *   npm run watch -- --dry           print the messages here instead of sending them
 *   npm run watch -- --every 10      seconds between looks (default 20)
 *   npm run watch -- --from <block>  start from that block instead of the last one seen
 *
 * Where the messages go is read from .env (or the environment):
 *   ALERT_TELEGRAM_BOT_TOKEN and ALERT_TELEGRAM_CHAT_ID   a Telegram bot
 *   ALERT_DISCORD_WEBHOOK_URL                              a Discord channel webhook
 * Set one or both. The last block looked at is kept in keeper/.watch.json so a
 * restart carries on where it stopped. Needs no mnemonic: it only reads the chain.
 */
import { deployment, evmClient } from "@stv/core";
import { channelsFrom, digestText, worthAlerting } from "@stv/core/alerts";
import { readHistory, sortAttempts, type Attempt, type KnownAccounts } from "@stv/core/history";
import { secret } from "@stv/core/node";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const once = args.includes("--once");
const dry = args.includes("--dry");
const every = Number(args[args.indexOf("--every") + 1] || 20) * 1000;
const fromArg = args.includes("--from") ? BigInt(args[args.indexOf("--from") + 1]!) : null;

const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", ".watch.json");
const client = evmClient();
const { owner, deployer, vaults } = deployment;
const known: KnownAccounts = { owner: owner.evm, deployer: deployer.evm, hybrid: vaults.hybrid.address, classic: vaults.classic.address };
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

function lastSeen(): bigint | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return BigInt((JSON.parse(readFileSync(STATE_FILE, "utf8")) as { block: string }).block);
  } catch {
    return null;
  }
}

function remember(block: bigint) {
  writeFileSync(STATE_FILE, JSON.stringify({ block: block.toString() }));
}

async function look(from: bigint): Promise<bigint> {
  const to = await client.getBlockNumber();
  if (to < from) return from - 1n;
  const [hybrid, classic] = await Promise.all([readHistory(client, vaults.hybrid.address, from, to), readHistory(client, vaults.classic.address, from, to)]);
  const fresh: Attempt[] = sortAttempts([...hybrid, ...classic]).filter((a) => worthAlerting(a, known));
  if (fresh.length > 0) {
    const text = digestText(fresh, known);
    if (dry) {
      console.log(text);
    } else {
      for (const channel of channels) {
        try {
          await channel.send(text);
          log(`sent ${fresh.length} alert${fresh.length === 1 ? "" : "s"} to ${channel.name}`);
        } catch (error) {
          log(`${channel.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  return to;
}

const channels = channelsFrom({ get: secret });

async function main() {
  if (channels.length === 0 && !dry) {
    throw new Error("no alert channel is set. Put ALERT_TELEGRAM_BOT_TOKEN and ALERT_TELEGRAM_CHAT_ID, or ALERT_DISCORD_WEBHOOK_URL, in .env (or run with --dry).");
  }
  let from = fromArg ?? lastSeen() ?? (await client.getBlockNumber());
  log(`watching both vaults from block ${from}${dry ? " (dry: printing, not sending)" : ` (${channels.map((c) => c.name).join(", ")})`}`);
  for (;;) {
    try {
      const to = await look(from);
      from = to + 1n;
      remember(to);
    } catch (error) {
      log(`read failed, will retry: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (once) return;
    await new Promise((r) => setTimeout(r, every));
  }
}

main().catch((error: unknown) => {
  log(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
