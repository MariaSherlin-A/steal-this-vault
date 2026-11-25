import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { REST } from "./lib/clients";
import { ChainProvider } from "./lib/useChain";
import { HistoryProvider } from "./lib/useHistory";
import { WalletProvider } from "./lib/useWallet";
import "./styles.css";

async function start() {
  // Development only: `?mockwallet` installs the official QoreX mock so the wallet flow can be exercised without the extension.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mockwallet")) {
    const { createQorexMock } = await import("@qorechain/qorex-wallet-mock");
    createQorexMock({ rest: REST }).install(window);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ChainProvider>
        <HistoryProvider>
          <WalletProvider>
            <App />
          </WalletProvider>
        </HistoryProvider>
      </ChainProvider>
    </StrictMode>,
  );
}

void start();
