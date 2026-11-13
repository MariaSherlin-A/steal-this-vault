// Spike 3: open an EVM window, deploy PqcProbe, and have the contract verify a
// real ML-DSA-87 signature on chain (and count a forged one).
import { readFileSync } from "node:fs";
import solc from "solc";
import { openEvmWindowMsg, closeEvmWindowMsg, fetchEvmWindow, pqcSign } from "@qorechain/sdk";
import { createWalletClient, createPublicClient, http, defineChain, toHex, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID, REST, EVM_RPC, loadVault, accountSequence, fee, report } from "./lib.mjs";

// --- compile
const source = readFileSync(new URL("./PqcProbe.sol", import.meta.url), "utf8");
const out = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { "PqcProbe.sol": { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
})));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
const { abi, evm } = out.contracts["PqcProbe.sol"].PqcProbe;
console.log("compiled, bytecode bytes:", evm.bytecode.object.length / 2);

// --- window (hybrid-signed by the real owner)
const { account, signer, transport } = await loadVault();
const me = account.cosmos;
const sendNative = async (messages) => signer.signAndBroadcast(transport, { chainId: CHAIN_ID, ...(await accountSequence(me)), fee: fee(60000, 400000), messages });

report("open window:", await sendNative([openEvmWindowMsg({ sender: me, blocks: 300, maxTxs: 20, maxValue: "8000000" })]));
const w = await fetchEvmWindow({ rest: REST, address: me });
console.log("window live:", w.live, "| remaining txs:", String(w.remainingTxs), "| blocks:", String(w.remainingBlocks));

// --- EVM side, signed with the classical key only (as MetaMask would)
const chain = defineChain({ id: 9800, name: "QoreChain Testnet", nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 }, rpcUrls: { default: { http: [EVM_RPC] } } });
const evmAccount = privateKeyToAccount(account.privateKey);
const wallet = createWalletClient({ account: evmAccount, chain, transport: http(EVM_RPC) });
const pub = createPublicClient({ chain, transport: http(EVM_RPC) });
const wait = (hash) => pub.waitForTransactionReceipt({ hash, timeout: 120_000 });

const deployHash = await wallet.deployContract({ abi, bytecode: "0x" + evm.bytecode.object, gas: 1_500_000n });
const deployed = await wait(deployHash);
const probe = deployed.contractAddress;
console.log("deployed PqcProbe:", probe, "| status:", deployed.status, "| gas:", deployed.gasUsed.toString());

const [registered, alg, pubkey, pop] = await pub.readContract({ address: probe, abi, functionName: "keyOf", args: [evmAccount.address] });
console.log("keyOf(owner):", { registered, alg, pubkeyBytes: (pubkey.length - 2) / 2, pop, matchesLocal: pubkey === toHex(account.pqc.publicKey) });

const message = stringToBytes(`steal-this-vault|spike3|${probe.toLowerCase()}|nonce=1`);
const good = pqcSign(account.pqc.secretKey, message);
const forged = Uint8Array.from(good); forged[100] ^= 0xff;

for (const [label, sig] of [["valid signature", good], ["forged signature", forged]]) {
  const viewResult = await pub.readContract({ address: probe, abi, functionName: "verify", args: [pubkey, toHex(sig), toHex(message)] });
  const hash = await wallet.writeContract({ address: probe, abi, functionName: "check", args: [toHex(sig), toHex(message)], gas: 600_000n });
  const rc = await wait(hash);
  console.log(`${label}: view=${viewResult} | tx ${hash} status=${rc.status} gas=${rc.gasUsed}`);
}

const passed = await pub.readContract({ address: probe, abi, functionName: "passed" });
const failed = await pub.readContract({ address: probe, abi, functionName: "failed" });
console.log("on-chain counters -> passed:", passed.toString(), "failed:", failed.toString());

report("close window:", await sendNative([closeEvmWindowMsg(me)]));
