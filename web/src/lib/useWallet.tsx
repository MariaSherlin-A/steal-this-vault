/** The visitor's QoreX connection, shared by the header, the lab and the "raise the stakes" section. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { WalletError, connect as connectQorex, type Wallet, type WalletErrorKind } from "./qorex";

export interface WalletProblem {
  kind: WalletErrorKind;
  message: string;
}

export interface WalletState {
  wallet: Wallet | null;
  connecting: boolean;
  problem: WalletProblem | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const PLAIN: Record<WalletErrorKind, string> = {
  "not-installed": "QoreX is not installed in this browser. It is the QoreChain wallet. Install it, then come back and connect.",
  "too-old": "This version of QoreX cannot send a payment for a page yet. Update QoreX and try again.",
  rejected: "The request was declined in QoreX. Nothing was sent.",
  failed: "QoreX did not answer. Unlock it and try again.",
};

export function plainWalletError(error: unknown): WalletProblem {
  const kind: WalletErrorKind = error instanceof WalletError ? error.kind : "failed";
  return { kind, message: PLAIN[kind] };
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [problem, setProblem] = useState<WalletProblem | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setProblem(null);
    try {
      setWallet(await connectQorex());
    } catch (error) {
      setProblem(plainWalletError(error));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setProblem(null);
  }, []);

  const value = useMemo<WalletState>(
    () => ({ wallet, connecting, problem, connect, disconnect }),
    [wallet, connecting, problem, connect, disconnect],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside <WalletProvider>");
  return value;
}
