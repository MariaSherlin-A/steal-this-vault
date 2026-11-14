import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTACKS, GROUPS, attackInfo } from "../src/attack-list";
import { doorAdmits, type Door } from "../src/attacks";
import { MAX_WINDOW_BLOCKS, MAX_WINDOW_TXS, UQOR_PER_QOR, WEI_PER_QOR, WEI_PER_UQOR, explorer } from "../src/chain";
import { CLASSIC_VAULT, HYBRID_VAULT, deployment } from "../src/deployments";
import { classifyEvmRefusal } from "../src/evm";
import { REFUSAL_NAMES, REFUSAL_TEXT, Refusal, refusalName, stoppedByPostQuantumLayer } from "../src/refusal";

describe("refusal codes", () => {
  it("mirror the order of Vault.Refusal", () => {
    assert.deepEqual(REFUSAL_NAMES, ["None", "Expired", "WrongNonce", "NotAuthorized", "PqKeyUnavailable", "PqSignatureMalformed", "PqSignatureInvalid"]);
    REFUSAL_NAMES.forEach((name, code) => {
      assert.equal(Refusal[name], code);
      assert.equal(refusalName(code), name);
    });
    assert.throws(() => refusalName(7), /unknown refusal code/);
  });

  it("separates refusals only the post-quantum layer made", () => {
    assert.equal(stoppedByPostQuantumLayer(Refusal.NotAuthorized), false);
    assert.equal(stoppedByPostQuantumLayer(Refusal.WrongNonce), false);
    assert.equal(stoppedByPostQuantumLayer(Refusal.PqKeyUnavailable), true);
    assert.equal(stoppedByPostQuantumLayer(Refusal.PqSignatureMalformed), true);
    assert.equal(stoppedByPostQuantumLayer(Refusal.PqSignatureInvalid), true);
  });

  it("have plain and technical words for every code", () => {
    for (const name of REFUSAL_NAMES) {
      assert.ok(REFUSAL_TEXT[name].plain.length > 3, name);
      assert.ok(REFUSAL_TEXT[name].technical.length > 10, name);
    }
  });
});

describe("attack catalogue", () => {
  it("has unique ids and a known group for every attack", () => {
    const ids = ATTACKS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const attack of ATTACKS) {
      assert.ok(GROUPS[attack.group], attack.id);
      assert.ok(attack.id.startsWith(attack.group), attack.id);
      assert.equal(attackInfo(attack.id), attack);
    }
    assert.throws(() => attackInfo("nope"), /unknown attack/);
  });

  it("expects only the control vault to pay", () => {
    for (const attack of ATTACKS) {
      assert.equal(attack.expects, attack.group === "control" ? "paid" : "refused", attack.id);
    }
    assert.equal(ATTACKS.filter((a) => a.group === "control").length, 1);
  });

  it("keeps technical terms out of the plain descriptions", () => {
    const jargon = /ML-DSA|secp256k1|precompile|EIP-|ante handler|Msg[A-Z]|0x[0-9a-f]{4}/;
    for (const attack of ATTACKS) assert.doesNotMatch(attack.plain, jargon, attack.id);
    for (const group of Object.values(GROUPS)) assert.doesNotMatch(group.plain, jargon, group.title);
  });
});

describe("classifyEvmRefusal", () => {
  const cases: [string, string][] = [
    ["rpc error: no open EVM authorisation window for sender", "no-window"],
    ["0xabc is not an allowed recipient of this window", "target-not-allowed"],
    ["window is native-only", "window-scope"],
    ["window exhausted: tx budget spent", "window-exhausted"],
    ["sender has no registered PQC key", "no-pqc-key"],
    ["EIP-7702 delegation requires hybrid consent", "delegation-consent"],
    ["nonce too low", "nonce"],
    ["insufficient funds for gas * price + value", "funds"],
    ["something nobody has seen before", "other"],
  ];
  for (const [message, kind] of cases) {
    it(`reads "${message.slice(0, 40)}" as ${kind}`, () => {
      assert.equal(classifyEvmRefusal(new Error(message)).kind, kind);
    });
  }

  it("keeps the node's sentence and drops the wrapping", () => {
    const refusal = classifyEvmRefusal(new Error("no open EVM authorisation window   for sender [cosmossdk.io/errors@v1.0.1/errors.go:151] URL: https://example"));
    assert.equal(refusal.message, "no open EVM authorisation window for sender");
  });

  it("accepts non-Error values", () => {
    assert.equal(classifyEvmRefusal("nonce too high").kind, "nonce");
  });
});

describe("doorAdmits", () => {
  const door: Door = {
    open: true,
    targets: [HYBRID_VAULT, CLASSIC_VAULT],
    nativeOnly: false,
    remainingBlocks: 100n,
    remainingTxs: 10n,
    remainingValueUqor: 100_000n,
    usedTxs: 0n,
    usedValueUqor: 0n,
    maxTxs: 10n,
    maxValueUqor: 100_000n,
    expiryHeight: 1_000n,
  };
  const elsewhere = "0x000000000000000000000000000000000000dEaD";

  it("admits the listed vaults and nothing else", () => {
    assert.equal(doorAdmits(door, HYBRID_VAULT), true);
    assert.equal(doorAdmits(door, HYBRID_VAULT.toLowerCase() as typeof HYBRID_VAULT), true);
    assert.equal(doorAdmits(door, elsewhere), false);
  });

  it("admits anything when the window is unscoped", () => {
    assert.equal(doorAdmits({ ...door, targets: [] }, elsewhere), true);
  });

  it("admits nothing when closed, native-only or spent", () => {
    assert.equal(doorAdmits({ ...door, open: false }, HYBRID_VAULT), false);
    assert.equal(doorAdmits({ ...door, nativeOnly: true }, HYBRID_VAULT), false);
    assert.equal(doorAdmits({ ...door, remainingTxs: 0n }, HYBRID_VAULT), false);
  });
});

describe("chain constants and deployment", () => {
  it("agree on units", () => {
    assert.equal(WEI_PER_UQOR * UQOR_PER_QOR, WEI_PER_QOR);
    assert.equal(MAX_WINDOW_BLOCKS, 17_280n);
    assert.equal(MAX_WINDOW_TXS, 1_000n);
  });

  it("builds explorer links", () => {
    assert.equal(explorer.tx("0xabc"), "https://explore.qore.network/tx/0xabc");
    assert.equal(explorer.block(12n), "https://explore.qore.network/block/12");
  });

  it("describes a testnet deployment with one vault of each kind", () => {
    assert.equal(deployment.evmChainId, 9800);
    assert.equal(deployment.vaults.hybrid.postQuantum, true);
    assert.equal(deployment.vaults.classic.postQuantum, false);
    assert.notEqual(HYBRID_VAULT, CLASSIC_VAULT);
    assert.match(deployment.vaults.hybrid.native, /^qor1/);
    assert.match(deployment.owner.native, /^qor1/);
  });
});
