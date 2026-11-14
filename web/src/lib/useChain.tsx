/** Live chain state for the whole page, polled every few seconds. Nothing here is cached or made up. */
import type { Door } from "@stv/core/attacks";
import { readRecent, readStats, type VaultEntry, type VaultStats } from "@stv/core/evm";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { VAULTS, client, loadLab } from "./clients";

export interface VaultView {
  stats: VaultStats;
  recent: VaultEntry[];
}

interface EvmState {
  /** `loading` before the first answer; `live` while answers keep coming; `offline` when the last read failed. */
  status: "loading" | "live" | "offline";
  block: bigint | null;
  hybrid: VaultView | null;
  classic: VaultView | null;
  /** When the last successful read finished (ms since epoch). */
  updatedAt: number | null;
}

interface OwnerState {
  /** The owner account's EVM window. Null until the native lane has answered. */
  door: Door | null;
  ownerLiquidUqor: bigint | null;
}

export interface ChainState extends EvmState, OwnerState {
  /** Read again now, for example right after an attempt. */
  refresh: () => void;
}

const EVM_EVERY_MS = 6_000;
const OWNER_EVERY_MS = 15_000;

const ChainContext = createContext<ChainState | null>(null);

async function readVault(address: Address): Promise<VaultView> {
  const [stats, recent] = await Promise.all([readStats(client, address), readRecent(client, address)]);
  return { stats, recent };
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [evm, setEvm] = useState<EvmState>({ status: "loading", block: null, hybrid: null, classic: null, updatedAt: null });
  const [owner, setOwner] = useState<OwnerState>({ door: null, ownerLiquidUqor: null });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  // Vault counters and balances, over the EVM RPC.
  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      if (document.hidden) return;
      try {
        const [block, hybrid, classic] = await Promise.all([
          client.getBlockNumber({ cacheTime: 0 }),
          readVault(VAULTS.hybrid),
          readVault(VAULTS.classic),
        ]);
        if (!cancelled) setEvm({ status: "live", block, hybrid, classic, updatedAt: Date.now() });
      } catch {
        // Keep the last real values on screen, and say that they are no longer fresh.
        if (!cancelled) setEvm((prev) => ({ ...prev, status: "offline" }));
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), EVM_EVERY_MS);
    const onVisible = () => {
      if (!document.hidden) void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);

  // The owner's EVM window and balance, over the native lane. That needs the SDK, so it loads after first paint.
  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      if (document.hidden) return;
      try {
        const lab = await loadLab();
        const next = await lab.readOwner();
        if (!cancelled) setOwner({ door: next.door, ownerLiquidUqor: next.liquidUqor });
      } catch {
        // Leave the last reading; the lab says so when the window state is unknown.
      }
    };
    const start = window.setTimeout(() => void read(), tick === 0 ? 1_200 : 0);
    const timer = window.setInterval(() => void read(), OWNER_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [tick]);

  const value = useMemo<ChainState>(() => ({ ...evm, ...owner, refresh }), [evm, owner, refresh]);
  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain(): ChainState {
  const value = useContext(ChainContext);
  if (!value) throw new Error("useChain must be used inside <ChainProvider>");
  return value;
}
