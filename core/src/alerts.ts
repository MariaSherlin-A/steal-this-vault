/**
 * Alerts: a message to the owner the moment the leaked key is used.
 *
 * On an ordinary chain the owner learns of a stolen key when the money is gone.
 * Here the vault refuses and logs the attempt, so the owner can be told while
 * the money is still there. The message is built here, in plain words; where
 * it goes (Telegram, Discord) is decided by whatever is configured.
 */
import { explorer } from "./chain";
import { type Attempt, type KnownAccounts, fingerprint, labelFor } from "./history";
import { REFUSAL_TEXT } from "./refusal";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 0.01 QOR, from wei, with at most 4 decimals and no trailing zeros. */
export function qorText(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = ((wei % 10n ** 18n) / 10n ** 14n).toString().padStart(4, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac} QOR` : `${whole} QOR`;
}

/**
 * Whether an attempt deserves an alert. The owner's own withdrawals from the
 * two-lock vault (which need both keys) and the keeper taking bait money back
 * from the one-lock vault are routine, not news.
 */
export function worthAlerting(attempt: Attempt, known: KnownAccounts): boolean {
  if (attempt.kind === "paid" && same(attempt.vault, known.hybrid)) return false;
  return !same(fingerprint(attempt, known), known.owner);
}

/** One alert, in plain words, for one attempt. */
export function alertText(attempt: Attempt, known: KnownAccounts): string {
  const vault = same(attempt.vault, known.hybrid) ? "the two-lock vault" : "the one-lock vault";
  const wallet = fingerprint(attempt, known);
  const who = labelFor(wallet, known) ?? "a stranger";
  const lines: string[] = [];
  if (attempt.kind === "paid") {
    lines.push(`ROBBED: ${vault} paid ${qorText(attempt.amount)} to ${who}.`);
  } else {
    lines.push(`Refused: ${vault} turned away a withdrawal of ${qorText(attempt.amount)}.`);
    lines.push(REFUSAL_TEXT[attempt.refusal].plain);
  }
  lines.push(`${attempt.keyholder ? "The published key was used." : "The published key was not used."} Money was to go to ${wallet} (${who}), sent by ${attempt.caller}.`);
  lines.push(`Block ${attempt.blockNumber}: ${explorer.tx(attempt.txHash)}`);
  return lines.join("\n");
}

/** Several attempts in one message, so a burst of attacks does not become a burst of messages. */
export function digestText(attempts: readonly Attempt[], known: KnownAccounts, max = 5): string {
  const shown = attempts.slice(0, max).map((a) => alertText(a, known));
  const more = attempts.length - shown.length;
  const head = attempts.length === 1 ? "Steal This Vault: the key was just used." : `Steal This Vault: ${attempts.length} attempts on the vaults.`;
  return [head, ...shown, ...(more > 0 ? [`...and ${more} more. Run \`npm run intruders\` for the full file.`] : [])].join("\n\n");
}

// ---------------------------------------------------------------- where it goes

export interface Channel {
  name: string;
  send(text: string): Promise<void>;
}

type Fetch = typeof fetch;

export function telegramChannel(botToken: string, chatId: string, fetchFn: Fetch = fetch): Channel {
  return {
    name: "telegram",
    async send(text) {
      const res = await fetchFn(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      if (!res.ok) throw new Error(`telegram answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
  };
}

export function discordChannel(webhookUrl: string, fetchFn: Fetch = fetch): Channel {
  return {
    name: "discord",
    async send(text) {
      const res = await fetchFn(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text.slice(0, 1990) }),
      });
      if (!res.ok) throw new Error(`discord answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
  };
}

/** The channels the configuration names. Empty when none is set. */
export function channelsFrom(env: { get(name: string): string | undefined }, fetchFn: Fetch = fetch): Channel[] {
  const out: Channel[] = [];
  const token = env.get("ALERT_TELEGRAM_BOT_TOKEN");
  const chat = env.get("ALERT_TELEGRAM_CHAT_ID");
  if (token && chat) out.push(telegramChannel(token, chat, fetchFn));
  const webhook = env.get("ALERT_DISCORD_WEBHOOK_URL");
  if (webhook) out.push(discordChannel(webhook, fetchFn));
  return out;
}
