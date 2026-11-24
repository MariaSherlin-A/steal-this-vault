/** The visitor's own payment into the vault, signed by QoreX with both of the visitor's keys. */
import { explorer } from "@stv/core/chain";
import { QOREX_DOWNLOAD_URLS } from "@qorechain/qorex-types";
import { useEffect, useState } from "react";
import { DEPLOYMENT, loadLab } from "../lib/clients";
import { short, uqorToQor } from "../lib/format";
import { pay, type Payment } from "../lib/qorex";
import { useChain } from "../lib/useChain";
import { plainWalletError, useWallet } from "../lib/useWallet";
import { CheckIcon, LockShieldIcon, WalletIcon, WarnShieldIcon } from "./icons";
import { Ext, Reveal, Skeleton } from "./ui";
import { Head } from "./Poster";

const AMOUNTS = [100_000n, 500_000n, 1_000_000n] as const;
/** Kept back for the network fee. */
const FEE_ROOM_UQOR = 20_000n;

interface Mine {
  registered: boolean;
  proven: boolean;
  balance: bigint;
}

export function Stake() {
  const { wallet, connecting, problem, connect } = useWallet();
  const { refresh } = useChain();
  const [mine, setMine] = useState<Mine | null>(null);
  const [amount, setAmount] = useState<bigint>(AMOUNTS[0]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMine(null);
    setSent(null);
    setError(null);
    if (!wallet) return;
    let cancelled = false;
    void (async () => {
      try {
        const lab = await loadLab();
        const [lock, balance] = await Promise.all([lab.secondLock(wallet.native), lab.nativeBalance(wallet.native)]);
        if (!cancelled) setMine({ ...lock, balance });
      } catch {
        // Unknown is shown as unknown; the payment button stays usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, sent]);

  const send = async () => {
    if (!wallet) return;
    setSending(true);
    setError(null);
    try {
      const result = await pay(wallet, DEPLOYMENT.vaults.hybrid.native, amount);
      if (result.code === 0) {
        setSent(result);
        refresh();
      } else {
        setError(`The network did not accept the payment (code ${result.code}). Nothing left your wallet.`);
      }
    } catch (e) {
      setError(plainWalletError(e).message);
    } finally {
      setSending(false);
    }
  };

  const short_of_funds = mine !== null && mine.balance < amount + FEE_ROOM_UQOR;

  return (
    <section className="sec sec--ink stakesec" id="stake">
      <div className="wrap stake">
        <Head
          n="07.1"
          file="RAISE_STAKES.TX"
          lines={["Raise", <em key="p">the stakes.</em>]}
          lead="Sure it will fall? Then add to the prize. Send a little testnet QOR into the two-lock vault from your own wallet. QoreX signs your payment with both of your keys, the same protection the owner has. The more it holds, the more there is to steal. Testnet QOR is free from the faucet and has no money value."
        />

        <Reveal className="panel stake-panel" delay={100}>
          {!wallet ? (
            <>
              <h3>
                <WalletIcon size={18} /> Connect your wallet
              </h3>
              <p>QoreX is the QoreChain wallet. This page only sees your address. It never sees a key.</p>
              <button type="button" className="btn btn--primary" onClick={() => void connect()} disabled={connecting}>
                {connecting ? "Waiting for QoreX" : "Connect QoreX"}
              </button>
              {problem && (
                <p className="notice notice--alarm" role="alert">
                  <WarnShieldIcon size={16} /> {problem.message}
                </p>
              )}
              <p className="fine">
                No wallet yet? <Ext href={QOREX_DOWNLOAD_URLS.chrome}>Get QoreX for Chrome</Ext> or{" "}
                <Ext href={QOREX_DOWNLOAD_URLS.firefox}>Firefox</Ext>, then take free coins from the{" "}
                <Ext href="https://dashboard.qorechain.io/faucet">faucet</Ext>.
              </p>
            </>
          ) : (
            <>
              <h3>
                <LockShieldIcon size={18} /> Your account
              </h3>
              <dl className="kv kv--tight">
                <dt>Address</dt>
                <dd className="mono">{short(wallet.native, 10, 6)}</dd>
                <dt>Balance</dt>
                <dd>{mine ? `${uqorToQor(mine.balance)} QOR` : <Skeleton width="8ch" />}</dd>
                <dt>Second lock</dt>
                <dd>
                  {mine === null ? (
                    <Skeleton width="12ch" />
                  ) : mine.registered ? (
                    mine.proven ? "On. Your account is protected the same way." : "A second key is on record, without proof that you hold it."
                  ) : (
                    "Not set up yet. QoreX can add one for you."
                  )}
                </dd>
              </dl>

              <div className="amounts" role="group" aria-label="Amount to send">
                {AMOUNTS.map((a) => (
                  <button key={a.toString()} type="button" className={`chip ${a === amount ? "chip--on" : ""}`} onClick={() => setAmount(a)}>
                    {uqorToQor(a)} QOR
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn--primary" onClick={() => void send()} disabled={sending || short_of_funds}>
                {sending ? "Waiting for QoreX" : `Put ${uqorToQor(amount)} QOR in the vault`}
              </button>
              {short_of_funds && <p className="fine">Your balance does not cover this amount and the fee.</p>}
              {error && (
                <p className="notice notice--alarm" role="alert">
                  <WarnShieldIcon size={16} /> {error}
                </p>
              )}
              {sent && (
                <p className="notice notice--held" role="status">
                  <CheckIcon size={16} />
                  <span>
                    In the vault. <Ext href={explorer.tx(sent.txHash)}>See your payment</Ext>.{" "}
                    {sent.shield === "shielded"
                      ? "QoreX confirmed it carries both of your signatures."
                      : sent.shield === "downgraded"
                        ? "Warning: QoreX reports it went through without your second signature."
                        : "QoreX is still confirming that it carries both signatures."}
                  </span>
                </p>
              )}
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
