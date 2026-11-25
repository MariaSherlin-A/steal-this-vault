/**
 * The whole attempt history of both vaults, read from their event logs and kept
 * in the browser between visits so a return visit only reads the new blocks.
 * Rereads whenever the vault counters move.
 */
import { attemptFromJson, attemptToJson, intruderFile, readHistory, type Attempt, type AttemptJson, type IntruderFile, type KnownAccounts } from "@stv/core/history";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { DEPLOYMENT, VAULTS, client } from "./clients";
import { useChain } from "./useChain";

export const KNOWN: KnownAccounts = {
  owner: DEPLOYMENT.owner.evm,
  deployer: DEPLOYMENT.deployer.evm,
  hybrid: VAULTS.hybrid,
  classic: VAULTS.classic,
};

interface Cached {
  toBlock: string;
  attempts: AttemptJson[];
}

const cacheKey = (vault: Address) => `stv.history.v1.${vault.toLowerCase()}`;

function load(vault: Address): { toBlock: bigint; attempts: Attempt[] } | null {
  try {
    const raw = localStorage.getItem(cacheKey(vault));
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return { toBlock: BigInt(c.toBlock), attempts: c.attempts.map(attemptFromJson) };
  } catch {
    return null;
  }
}

function save(vault: Address, toBlock: bigint, attempts: Attempt[]): void {
  try {
    const c: Cached = { toBlock: toBlock.toString(), attempts: attempts.map(attemptToJson) };
    localStorage.setItem(cacheKey(vault), JSON.stringify(c));
  } catch {
    // storage full or blocked: the page still works, it just reads everything next time
  }
}

/** Everything the vault has logged up to `block`, extending what the browser already holds. */
async function historyUpTo(vault: Address, deployBlock: bigint, block: bigint): Promise<Attempt[]> {
  const cached = load(vault);
  const from = cached ? cached.toBlock + 1n : deployBlock;
  const fresh = from <= block ? await readHistory(client, vault, from, block) : [];
  const attempts = [...(cached?.attempts ?? []), ...fresh];
  save(vault, block, attempts);
  return attempts;
}

export interface HistoryState {
  /** `loading` until the first full read; `live` after; `offline` when the last read failed and nothing is held. */
  status: "loading" | "live" | "offline";
  attempts: Attempt[];
  file: IntruderFile | null;
  /** The block the history is complete up to. */
  upTo: bigint | null;
}

/** One reader for the whole site, so the history is read once and survives moving between pages. */
function useHistoryReader(): HistoryState {
  const { block, hybrid, classic } = useChain();
  const [state, setState] = useState<{ attempts: Attempt[]; upTo: bigint | null; failed: boolean }>({ attempts: [], upTo: null, failed: false });
  const busy = useRef(false);

  // The counters say when something new has been written, so the logs are only reread then.
  const stamp = hybrid && classic ? `${hybrid.stats.refusedCount}/${hybrid.stats.paidCount}/${classic.stats.refusedCount}/${classic.stats.paidCount}` : null;

  useEffect(() => {
    if (block === null || stamp === null || busy.current) return;
    busy.current = true;
    let gone = false;
    Promise.all([
      historyUpTo(VAULTS.hybrid, BigInt(DEPLOYMENT.vaults.hybrid.deployBlock), block),
      historyUpTo(VAULTS.classic, BigInt(DEPLOYMENT.vaults.classic.deployBlock), block),
    ])
      .then(([h, c]) => {
        if (!gone) setState({ attempts: [...h, ...c], upTo: block, failed: false });
      })
      .catch(() => {
        if (!gone) setState((s) => ({ ...s, failed: true }));
      })
      .finally(() => {
        busy.current = false;
      });
    return () => {
      gone = true;
    };
  }, [stamp]);

  const file = useMemo(() => (state.upTo === null ? null : intruderFile(state.attempts, KNOWN)), [state.attempts, state.upTo]);
  const status: HistoryState["status"] = state.upTo !== null ? "live" : state.failed ? "offline" : "loading";
  return { status, attempts: state.attempts, file, upTo: state.upTo };
}

const HistoryContext = createContext<HistoryState | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const value = useHistoryReader();
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryState {
  const value = useContext(HistoryContext);
  if (!value) throw new Error("useHistory must be used inside <HistoryProvider>");
  return value;
}
