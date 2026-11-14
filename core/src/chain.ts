import { qorechainTestnet } from "@qorechain/evm";
import type { Address } from "viem";

/** QoreChain testnet (`qorechain-diana`). The project runs here and nowhere else. */
export const TESTNET = {
  name: "QoreChain testnet",
  /** Native-lane chain id. */
  nativeChainId: "qorechain-diana",
  /** EVM-lane chain id. */
  evmChainId: 9800,
  rest: "https://api-testnet.qore.host",
  rpc: "https://rpc-testnet.qore.host",
  evmRpc: "https://evm-testnet.qore.host",
  explorer: "https://explore.qore.network",
  faucet: "https://dashboard.qorechain.io/faucet",
} as const;

/** The viem chain definition, from the QoreChain EVM kit. */
export const chain = qorechainTestnet;

/** `pqcVerify(bytes pubkey, bytes signature, bytes message) returns (bool)` */
export const PQC_VERIFY_ADDRESS: Address = "0x0000000000000000000000000000000000000A01";
/** `pqcKeyStatus(address) returns (bool, uint8, bytes, bool)` */
export const PQC_KEY_STATUS_ADDRESS: Address = "0x0000000000000000000000000000000000000A02";

export const ML_DSA_87 = {
  algorithmId: 1,
  publicKeyLength: 2592,
  secretKeyLength: 4896,
  signatureLength: 4627,
} as const;

/** Native amounts are in uqor (6 decimals); EVM amounts are in wei (18 decimals). */
export const WEI_PER_UQOR = 10n ** 12n;
export const UQOR_PER_QOR = 10n ** 6n;
export const WEI_PER_QOR = 10n ** 18n;

/** The most blocks and transactions one EVM authorisation window can cover. */
export const MAX_WINDOW_BLOCKS = 17_280n;
export const MAX_WINDOW_TXS = 1_000n;

/**
 * The chain charges at least half of a transaction's gas limit, whatever it
 * used (measured on testnet, 13 Nov 2026: 300,000 charged of a 600,000 limit).
 * Gas limits are therefore set close to the estimate.
 */
export const MIN_GAS_CHARGE_FRACTION = 0.5;

export const explorer = {
  tx: (hash: string) => `${TESTNET.explorer}/tx/${hash}`,
  address: (address: string) => `${TESTNET.explorer}/address/${address}`,
  block: (height: bigint | number) => `${TESTNET.explorer}/block/${height}`,
};
