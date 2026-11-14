/**
 * Chain access the page needs for its first paint: one EVM client and the
 * deployment's addresses. Everything that needs the QoreChain SDK (the native
 * lane, the attack runner) lives in `lab.ts` and is loaded on demand.
 */
import { TESTNET } from "@stv/core/chain";
import { CLASSIC_VAULT, HYBRID_VAULT, deployment } from "@stv/core/deployments";
import { evmClient } from "@stv/core/evm";

/** The native REST API, reached through /lcd (vite proxy in development, vercel.json in production). */
export const REST = `${window.location.origin}/lcd`;

export const client = evmClient(TESTNET.evmRpc);

export const OWNER = deployment.owner;
export const VAULTS = { hybrid: HYBRID_VAULT, classic: CLASSIC_VAULT } as const;
export const DEPLOYMENT = deployment;

/** The heavy half of the app, fetched once and shared. */
let labPromise: Promise<typeof import("./lab")> | undefined;
export function loadLab(): Promise<typeof import("./lab")> {
  labPromise ??= import("./lab");
  return labPromise;
}

/** Where the source lives. */
export const REPO_URL = "https://github.com/MariaSherlin-A/steal-this-vault";
