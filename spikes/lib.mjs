// Shared helpers for the spikes. Never prints secrets.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StargateClient } from "@cosmjs/stargate";
import { deriveUnifiedAccount, EthNativeSigner } from "@qorechain/sdk";

export const CHAIN_ID = "qorechain-diana";
export const REST = "https://api-testnet.qore.host";
export const RPC = "https://rpc-testnet.qore.host";
export const EVM_RPC = "https://evm-testnet.qore.host";

export function loadMnemonic() {
  const env = readFileSync(fileURLToPath(new URL("../.env", import.meta.url)), "utf8");
  const m = env.match(/^VAULT_MNEMONIC="(.+)"$/m)?.[1];
  if (!m) throw new Error("VAULT_MNEMONIC missing from .env; run 00-create-account.mjs");
  return m;
}

export async function loadVault() {
  const account = await deriveUnifiedAccount(loadMnemonic());
  const signer = new EthNativeSigner(account, { rest: REST });
  const transport = await StargateClient.connect(RPC);
  return { account, signer, transport };
}

export async function getJson(path) {
  const res = await fetch(REST + path);
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** account_number and sequence, read over REST (works for eth_secp256k1 accounts). */
export async function accountSequence(address) {
  const { body } = await getJson(`/cosmos/auth/v1beta1/accounts/${address}`);
  const a = body?.account?.base_account ?? body?.account;
  if (!a?.account_number) throw new Error("account not found on chain: " + JSON.stringify(body));
  return { accountNumber: BigInt(a.account_number), sequence: BigInt(a.sequence ?? 0) };
}

export const fee = (uqor, gas) => ({ amount: [{ denom: "uqor", amount: String(uqor) }], gas: String(gas) });

export function report(label, r) {
  console.log(label, JSON.stringify({ code: r.code, hash: r.transactionHash, height: r.height, gasUsed: r.gasUsed?.toString(), log: r.code ? r.rawLog : undefined }));
}
