// Spike 1: register the vault's ML-DSA-87 key (with proof of possession),
// then send a hybrid-signed payment and read it back.
import {
  buildRegisterPqcKeyMsg,
  signProofOfPossession,
  fetchPqcStatus,
  clearPqcStatusCache,
  MSG_SEND_TYPE_URL,
} from "@qorechain/sdk";
import { CHAIN_ID, REST, loadVault, accountSequence, fee, report, getJson } from "./lib.mjs";

const { account, signer, transport } = await loadVault();
const me = account.cosmos;
console.log("vault owner:", me, account.evm);

let status = await fetchPqcStatus({ rest: REST, address: me });
console.log("PQC status before:", JSON.stringify({ registered: status.registered, possessionProven: status.possessionProven }));

if (!status.registered) {
  const proofOfPossession = signProofOfPossession({ chainId: CHAIN_ID, account: me, keypair: account.pqc });
  const msg = buildRegisterPqcKeyMsg(me, {
    pqcKeypair: account.pqc,
    keyType: "hybrid",
    proofOfPossession,
  });
  const seq = await accountSequence(me);
  // Bootstrap: the first registration is the one transaction signed classically.
  const r = await signer.signAndBroadcast(transport, {
    chainId: CHAIN_ID, messages: [msg], fee: fee(60000, 600000), ...seq, signMode: "classical",
  });
  report("register:", r);
  if (r.code) process.exit(1);
  clearPqcStatusCache();
  status = await fetchPqcStatus({ rest: REST, address: me });
  console.log("PQC status after:", JSON.stringify({ registered: status.registered, possessionProven: status.possessionProven }));
}

// Hybrid-signed self-send of 0.01 QOR.
const seq = await accountSequence(me);
const send = {
  typeUrl: MSG_SEND_TYPE_URL,
  value: { fromAddress: me, toAddress: me, amount: [{ denom: "uqor", amount: "10000" }] },
};
const r = await signer.signAndBroadcast(transport, {
  chainId: CHAIN_ID, messages: [send], fee: fee(60000, 400000), ...seq, memo: "steal-this-vault spike 1",
});
report("hybrid send:", r);

// Read it back from the chain.
if (!r.code) {
  const tx = await getJson(`/cosmos/tx/v1beta1/txs/${r.transactionHash}`);
  const body = tx.body?.tx?.body;
  console.log("read back:", JSON.stringify({
    http: tx.status,
    memo: body?.memo,
    extensions: body?.extension_options?.map((e) => e["@type"]) ?? body?.non_critical_extension_options?.map((e) => e["@type"]),
    height: tx.body?.tx_response?.height,
  }));
}
