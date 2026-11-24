/** 09: the technical details, for people who want to check. */
import { ML_DSA_87, PQC_KEY_STATUS_ADDRESS, PQC_VERIFY_ADDRESS, TESTNET, explorer } from "@stv/core/chain";
import { DEPLOYMENT, OWNER, REPO_URL, VAULTS } from "../lib/clients";
import { blocksToDuration, uqorToQor } from "../lib/format";
import { useChain } from "../lib/useChain";
import { Addr, Ext, Reveal, Skeleton } from "./ui";
import { Head } from "./Poster";

export function Technical() {
  const { door, ownerLiquidUqor } = useChain();
  return (
    <section className="sec sec--ink techsec" id="technical">
      <div className="wrap">
        <Head
          n="09"
          file="TECHNICAL.MD"
          lines={["For the", <em key="s">sceptics.</em>]}
          lead="How the two locks are built, where every piece lives on the chain, and how to check each claim on this site yourself."
        />

        <div className="tech">
          <Reveal className="panel">
            <h3>Where things are</h3>
            <dl className="kv">
              <dt>Network</dt>
              <dd>
                QoreChain testnet <span className="mono">{TESTNET.nativeChainId}</span>, EVM chain id{" "}
                <span className="mono">{TESTNET.evmChainId}</span>
              </dd>
              <dt>Owner account</dt>
              <dd>
                <Addr value={OWNER.evm} full /> <br />
                <span className="mono">{OWNER.native}</span>
              </dd>
              <dt>Hybrid vault</dt>
              <dd>
                <Addr value={VAULTS.hybrid} full /> (<span className="mono">postQuantum = true</span>, block{" "}
                {DEPLOYMENT.vaults.hybrid.deployBlock})
              </dd>
              <dt>Control vault</dt>
              <dd>
                <Addr value={VAULTS.classic} full /> (<span className="mono">postQuantum = false</span>, block{" "}
                {DEPLOYMENT.vaults.classic.deployBlock})
              </dd>
              <dt>Precompiles</dt>
              <dd>
                <span className="mono">pqcVerify</span> at <span className="mono">{PQC_VERIFY_ADDRESS}</span>,{" "}
                <span className="mono">pqcKeyStatus</span> at <span className="mono">{PQC_KEY_STATUS_ADDRESS}</span>
              </dd>
              <dt>Drill proof</dt>
              <dd>
                Native <span className="mono">MsgSend</span> of 0.01 QOR, owner to hybrid vault, with the{" "}
                <span className="mono">PQCHybridSignature</span> extension, 18 Nov 2026:{" "}
                <Ext href={explorer.tx("860064E01688CBCD7EF3D4D699BB8741DF4BD8894594EF2A0E6CE0A621A192AC")} className="mono">
                  860064E0…A192AC
                </Ext>
              </dd>
              <dt>Source</dt>
              <dd>
                <Ext href={REPO_URL}>The repository</Ext>: contracts, attack runner, keeper, this site. MIT licence.
              </dd>
            </dl>
          </Reveal>

          <Reveal className="panel" delay={80}>
            <h3>What is checked, and by whom</h3>
            <dl className="kv">
              <dt>Native lane</dt>
              <dd>
                The owner account has an ML-DSA-87 key registered with proof of possession. The chain’s ante handler then rejects any
                native transaction from it that lacks the hybrid signature extension (<span className="mono">pqc</span> code 20).
              </dd>
              <dt>EVM lane</dt>
              <dd>
                secp256k1-signed transactions are admitted only inside an EVM authorisation window, opened with a hybrid signature and
                scoped with <span className="mono">allowedTargets</span> to the two vaults.
              </dd>
              <dt>Vault</dt>
              <dd>
                <span className="mono">Vault.withdraw</span> checks the classical authority (caller or EIP-712 signature), then reads
                the owner’s key with <span className="mono">pqcKeyStatus</span> and verifies an ML-DSA-87 signature (
                {ML_DSA_87.signatureLength} bytes) with <span className="mono">pqcVerify</span> over{" "}
                <span className="mono">abi.encodePacked(PQ_DOMAIN_TAG, block.chainid, address(this), signer, intent)</span>. The
                intent carries recipient, amount, nonce and deadline, so a signature cannot be replayed or redirected. Refusals are
                counted in storage instead of reverting.
              </dd>
              <dt>Counterfactual counter</dt>
              <dd>
                When the classical layer passes and the post-quantum layer fails, the vault adds the amount to{" "}
                <span className="mono">counterfactualLoss</span>: what a one-signature vault would have paid.
              </dd>
            </dl>
          </Reveal>

          <Reveal className="panel">
            <h3>The side door, right now</h3>
            {door === null ? (
              <p>
                <Skeleton width="100%" />
              </p>
            ) : (
              <dl className="kv">
                <dt>EVM window</dt>
                <dd>{door.open ? `Open, expires at block ${door.expiryHeight} (about ${blocksToDuration(door.remainingBlocks)})` : "Closed"}</dd>
                <dt>Scope</dt>
                <dd>
                  {door.targets.length ? door.targets.map((t) => <Addr key={t} value={t} />).reduce<React.ReactNode[]>((all, el) => (all.length ? [...all, ", ", el] : [el]), []) : "No targets listed"}
                </dd>
                <dt>Left in the window</dt>
                <dd>
                  {door.remainingTxs.toString()} of {door.maxTxs.toString()} transactions, {uqorToQor(door.remainingValueUqor)} of{" "}
                  {uqorToQor(door.maxValueUqor)} QOR in fees
                </dd>
                <dt>Owner balance</dt>
                <dd>{ownerLiquidUqor === null ? "Unknown" : `${uqorToQor(ownerLiquidUqor)} QOR liquid, unreachable with the published key`}</dd>
              </dl>
            )}
            <p className="panel-note">
              A scheduled keeper holds the hybrid key in a secret store, renews the window before it expires and refills the control
              vault.
            </p>
          </Reveal>

          <Reveal className="panel" delay={80}>
            <h3>Run it yourself</h3>
            <pre className="code">
              <code>{`git clone ${REPO_URL}\ncd steal-this-vault && npm install\nnpm run heist     # every attack, from your terminal\nnpm run status    # both vaults and the window, read from the chain\nnpm run check     # contracts, types, lint, tests`}</code>
            </pre>
            <h3>Known limits and how we handle them</h3>
            <dl className="limits2">
              <dt>Testnet only</dt>
              <dd>
                The two signature checkers (<span className="mono">pqcVerify</span>, <span className="mono">pqcKeyStatus</span>) exist on the
                QoreChain testnet, not yet on mainnet. <b>Handled:</b> the contracts reach them through one small library that fails
                closed: if a checker is missing or answers oddly, the vault refuses. It can lock up, it can never pay out wrongly.
              </dd>
              <dt>No real quantum computer</dt>
              <dd>
                This proves the stolen ordinary key is useless on its own; it does not attack ML-DSA-87 with a quantum computer.{" "}
                <b>Handled:</b> the second key is ML-DSA-87 at its highest level, the NIST standard FIPS 204, the scheme the chain
                itself uses.
              </dd>
              <dt>Visitors can use up the fee allowance</dt>
              <dd>
                Recorded attempts spend the owner&rsquo;s fee allowance inside the side-door window. <b>Handled:</b> the window caps
                transactions and fees, the money is never at risk, the lab then checks attempts live without writing them, and the keeper
                renews the allowance.
              </dd>
              <dt>The keeper</dt>
              <dd>
                A scheduled job renews the side door. <b>Handled:</b> if it stops, the door closes, so the vault gets harder to reach,
                not easier; the owner can still act with both keys on the native lane.
              </dd>
              <dt>One mnemonic</dt>
              <dd>
                Both of the owner&rsquo;s keys come from one mnemonic, so a leak of it would defeat the vault. <b>Handled:</b> it lives
                only in a local secret file and the CI secret store, never on this site, and the rescue command moves everything to a
                fresh account with its own second lock.
              </dd>
            </dl>
          </Reveal>

          <Reveal className="panel panel--wide">
            <h3>Use the second lock in your own app</h3>
            <p className="panel-lead">
              The two-lock check is not tied to this vault. Any contract on QoreChain can inherit it and demand both signatures before
              it moves money: a treasury, a payroll contract, a game&rsquo;s prize pool. The repository includes a ready example,{" "}
              <Ext href={`${REPO_URL}/blob/main/contracts/src/examples/HybridAccount.sol`}>HybridAccount.sol</Ext>, an account that
              makes any call only when both keys sign.
            </p>
            <pre className="code">
              <code>{`import {HybridAuth} from "./HybridAuth.sol";

contract MyTreasury is HybridAuth {
    address public immutable owner;
    constructor(address owner_) HybridAuth("My Treasury", "1") { owner = owner_; }

    function release(bytes memory intent, bytes calldata sigOrdinary, bytes calldata sigQuantumSafe) external {
        // Reverts unless the owner's ordinary key AND their registered ML-DSA-87 key both signed this intent.
        _requireHybrid(owner, intent, sigOrdinary, sigQuantumSafe);
        // ...your logic: decode the intent, check its nonce and deadline, pay out.
    }
}`}</code>
            </pre>
            <p className="panel-note">
              Your contract still owns its own rules: put a nonce and a deadline in the intent and check them, as the vault does, so a
              signature cannot be replayed.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
