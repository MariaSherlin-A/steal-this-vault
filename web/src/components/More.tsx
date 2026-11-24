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
          lead="Everything on this site, in the terms a developer or a judge would use. All of it can be checked from the links."
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
            <h3>Honest limits</h3>
            <ul className="limits">
              <li>Testnet only. The two precompiles exist on the testnet and not yet on mainnet.</li>
              <li>
                It shows that the classical key alone is not enough. It does not test ML-DSA-87 against a real quantum computer; that
                rests on the NIST standard (FIPS 204).
              </li>
              <li>
                Recorded attempts spend the owner’s fee allowance inside the window. A visitor can use it up; the vault’s money is not
                at risk, and the lab then checks attempts without writing them.
              </li>
              <li>
                If the keeper stops, the window closes. The vault gets harder to reach, not easier, but vault-level attempts are then
                refused earlier, by the chain.
              </li>
              <li>Both of the owner’s keys derive from one mnemonic. A leak of that mnemonic would defeat the vault.</li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
