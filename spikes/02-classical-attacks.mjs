// Spike 2: attacks using ONLY the classical (ECDSA) key, with no EVM window open.
// Each should be refused by the chain. We capture the exact refusal.
import { MSG_SEND_TYPE_URL, fetchEvmWindow, classifyEvmWindowRejection, openEvmWindowMsg, closeEvmWindowMsg, EthNativeSigner } from "@qorechain/sdk";
import { createWalletClient, createPublicClient, http, parseEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID, REST, EVM_RPC, loadVault, accountSequence, fee } from "./lib.mjs";

const { account, signer, transport } = await loadVault();
const me = account.cosmos;
// The thief: same ECDSA key, but no post-quantum signature attached.
// (signMode is a constructor option; passing it per call is silently ignored.)
const thief = new EthNativeSigner(account, { rest: REST, signMode: "classical" });
const SINK = "0x000000000000000000000000000000000000dEaD";

const short = (e) => String(e?.rawLog ?? e?.details ?? e?.shortMessage ?? e?.message ?? e).replace(/\s+/g, " ").slice(0, 300);
async function attempt(name, fn) {
  try {
    const r = await fn();
    if (r?.code) console.log(`REFUSED  ${name}: code ${r.code} | ${short(r)}`);
    else console.log(`!! SUCCEEDED  ${name}: ${JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 200)}`);
  } catch (e) {
    console.log(`REFUSED  ${name}: ${short(e)} | kind=${classifyEvmWindowRejection(e) ?? "-"}`);
  }
}

// Start clean: close any window (hybrid-signed, as the real owner).
if ((await fetchEvmWindow({ rest: REST, address: me })).found) {
  const seq = await accountSequence(me);
  const r = await signer.signAndBroadcast(transport, { chainId: CHAIN_ID, ...seq, fee: fee(60000, 400000), messages: [closeEvmWindowMsg(me)] });
  console.log("closed existing window: code", r.code);
}
const win = await fetchEvmWindow({ rest: REST, address: me });
console.log("window before:", JSON.stringify({ found: win.found, live: win.live }));

// A1: native bank send, classical signature only.
await attempt("native transfer, classical only", async () => {
  const seq = await accountSequence(me);
  return thief.signAndBroadcast(transport, {
    chainId: CHAIN_ID, ...seq, fee: fee(60000, 400000),
    messages: [{ typeUrl: MSG_SEND_TYPE_URL, value: { fromAddress: me, toAddress: me, amount: [{ denom: "uqor", amount: "10000" }] } }],
  });
});

// A2: open an EVM window, classical signature only.
await attempt("open EVM window, classical only", async () => {
  const seq = await accountSequence(me);
  return thief.signAndBroadcast(transport, {
    chainId: CHAIN_ID, ...seq, fee: fee(60000, 400000),
    messages: [openEvmWindowMsg({ sender: me, blocks: 100, maxTxs: 10, maxValue: "1000000" })],
  });
});

// A3: EVM transfer with the ECDSA key, no window open.
const chain = defineChain({ id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 }, rpcUrls: { default: { http: [EVM_RPC] } } });
const evmAccount = privateKeyToAccount(account.privateKey);
const wallet = createWalletClient({ account: evmAccount, chain, transport: http(EVM_RPC) });
const pub = createPublicClient({ chain, transport: http(EVM_RPC) });
console.log("evm address matches:", evmAccount.address.toLowerCase() === account.evm.toLowerCase(), "| evm balance:", (await pub.getBalance({ address: evmAccount.address })).toString());

await attempt("EVM transfer, no window", () => wallet.sendTransaction({ to: SINK, value: parseEther("1"), gas: 21000n }));

// A4: EVM contract deployment, no window.
await attempt("EVM contract deploy, no window", () => wallet.sendTransaction({ data: "0x600a600c600039600a6000f3602a60005260206000f3", gas: 200000n }));
