import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Hex } from "viem";
import { alertText, channelsFrom, digestText, qorText, worthAlerting } from "../src/alerts";
import type { Attempt, KnownAccounts } from "../src/history";

const known: KnownAccounts = {
  owner: "0xA2E46aDeDADD7163b4178Bb07AA086765e55dd73",
  deployer: "0x965cc64A84Cf6E0D7089B72Ba918d7336b5900F0",
  hybrid: "0x877BA271d7BdFdb7dfA0BB5863E9FBF04885c483",
  classic: "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51",
};
const STRANGER: Address = "0xc303B5650E3b72Ede0247f81b9aff99eBb63fC1B";
const HASH: Hex = `0x${"cd".repeat(32)}`;

function attempt(over: Partial<Attempt>): Attempt {
  return { vault: known.hybrid, kind: "refused", caller: known.owner, to: STRANGER, amount: 10n ** 16n, nonce: 0n, refusal: "PqSignatureInvalid", keyholder: true, blockNumber: 10065964n, txHash: HASH, logIndex: 0, ...over };
}

describe("alerts", () => {
  it("formats QOR from wei", () => {
    assert.equal(qorText(10n ** 16n), "0.01 QOR");
    assert.equal(qorText(10n ** 18n), "1 QOR");
    assert.equal(qorText(12345n * 10n ** 14n), "1.2345 QOR");
  });

  it("skips the owner's own routine payments", () => {
    assert.equal(worthAlerting(attempt({}), known), true);
    assert.equal(worthAlerting(attempt({ kind: "paid", refusal: "None", to: known.deployer }), known), false);
    assert.equal(worthAlerting(attempt({ vault: known.classic, kind: "paid", refusal: "None", to: known.owner }), known), false);
    assert.equal(worthAlerting(attempt({ vault: known.classic, kind: "paid", refusal: "None", to: STRANGER }), known), true);
  });

  it("says what happened in plain words with a link", () => {
    const refused = alertText(attempt({}), known);
    assert.match(refused, /^Refused: the two-lock vault turned away a withdrawal of 0\.01 QOR\./);
    assert.match(refused, /The second key is a fake/);
    assert.match(refused, /The published key was used\. Money was to go to 0xc303.* \(a stranger\)/);
    assert.match(refused, /Block 10065964: https:\/\//);
    const robbed = alertText(attempt({ vault: known.classic, kind: "paid", refusal: "None" }), known);
    assert.match(robbed, /^ROBBED: the one-lock vault paid 0\.01 QOR to a stranger\./);
  });

  it("digests a burst into one message", () => {
    const many = Array.from({ length: 7 }, (_, i) => attempt({ blockNumber: BigInt(100 + i) }));
    const text = digestText(many, known);
    assert.match(text, /^Steal This Vault: 7 attempts on the vaults\./);
    assert.match(text, /\.\.\.and 2 more\./);
    assert.match(digestText(many.slice(0, 1), known), /^Steal This Vault: the key was just used\./);
  });

  it("builds channels from the configuration and posts to them", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const env = { get: (n: string) => ({ ALERT_TELEGRAM_BOT_TOKEN: "t0k", ALERT_TELEGRAM_CHAT_ID: "42", ALERT_DISCORD_WEBHOOK_URL: "https://discord.example/hook" })[n] };
    const channels = channelsFrom(env, fetchFn);
    assert.deepEqual(channels.map((c) => c.name), ["telegram", "discord"]);
    for (const c of channels) await c.send("hello");
    assert.equal(calls[0]!.url, "https://api.telegram.org/bott0k/sendMessage");
    assert.deepEqual(JSON.parse(calls[0]!.body), { chat_id: "42", text: "hello", disable_web_page_preview: true });
    assert.equal(calls[1]!.url, "https://discord.example/hook");
    assert.deepEqual(JSON.parse(calls[1]!.body), { content: "hello" });
    assert.deepEqual(channelsFrom({ get: () => undefined }, fetchFn), []);
    const failing = channelsFrom(env, (async () => new Response("nope", { status: 403 })) as typeof fetch);
    await assert.rejects(failing[0]!.send("x"), /telegram answered 403/);
  });
});
