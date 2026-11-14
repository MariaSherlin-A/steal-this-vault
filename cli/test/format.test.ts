import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AttackResult, Door } from "@stv/core/attacks";
import {
  ago,
  formatResult,
  formatStatus,
  jsonReplacer,
  listAttacks,
  parseArgs,
  statusProblems,
  summarise,
  type StatusReport,
  type VaultReport,
} from "../src/format";

const door: Door = {
  open: true,
  targets: ["0x877BA271d7BdFdb7dfA0BB5863E9FBF04885c483", "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51"],
  nativeOnly: false,
  remainingBlocks: 9_198n,
  remainingTxs: 393n,
  remainingValueUqor: 325_833n,
  usedTxs: 7n,
  usedValueUqor: 174_167n,
  maxTxs: 400n,
  maxValueUqor: 500_000n,
  expiryHeight: 10_075_929n,
};

const vault = (over: Partial<VaultReport> = {}): VaultReport => ({
  label: "Hybrid vault",
  address: "0x877BA271d7BdFdb7dfA0BB5863E9FBF04885c483",
  postQuantum: true,
  balance: 9_999_000_000_000_000_000n,
  paidCount: 1n,
  paidTotal: 1_000_000_000_000_000n,
  refusedCount: 5n,
  keyholderRefusedCount: 5n,
  counterfactualThefts: 4n,
  counterfactualLoss: 39_996_000_000_000_000_000n,
  lastPaidAt: 10_054_300n,
  lastRefusedAt: 10_054_400n,
  refusedBy: { WrongNonce: 1n, PqSignatureMalformed: 1n, PqSignatureInvalid: 3n },
  ...over,
});

const report = (over: Partial<StatusReport> = {}): StatusReport => ({
  network: "qorechain-diana",
  evmChainId: 9800,
  block: 10_066_731n,
  owner: {
    evm: "0xA2E46aDeDADD7163b4178Bb07AA086765e55dd73",
    native: "qor15tjx4hk6m4ck8dqh3wc84gyxwe09thtnfj6z7w",
    liquidUqor: 31_046_454n,
    pqcRegistered: true,
    possessionProven: true,
  },
  door,
  vaults: [vault(), vault({ label: "Control vault", postQuantum: false, address: "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51" })],
  ...over,
});

const result = (over: Partial<AttackResult>): AttackResult => ({
  id: "native-transfer",
  verdict: "refused",
  ok: true,
  by: "chain",
  code: "pqc 20",
  detail: "hybrid PQC signature required",
  mode: "broadcast",
  ms: 812,
  ...over,
});

describe("parseArgs", () => {
  it("defaults to a dry, human-readable run of everything", () => {
    assert.deepEqual(parseArgs([]), { record: false, json: false, list: false, help: false });
  });

  it("reads flags and values", () => {
    const options = parseArgs(["--record", "--json", "--only", "native-transfer, vault-forged", "--loot", "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51"]);
    assert.equal(options.record, true);
    assert.equal(options.json, true);
    assert.deepEqual(options.only, ["native-transfer", "vault-forged"]);
    assert.equal(options.loot, "0x57AD197DcfDbb76EDE44B0f3c239965Fae0A8F51");
  });

  it("rejects unknown options, unknown attacks and bad values", () => {
    assert.throws(() => parseArgs(["--nope"]), /unknown option/);
    assert.throws(() => parseArgs(["--only", "not-an-attack"]), /unknown attack/);
    assert.throws(() => parseArgs(["--only"]), /needs a value/);
    assert.throws(() => parseArgs(["--loot", "0x123"]), /0x address/);
    assert.throws(() => parseArgs(["--key", "0x1234"]), /64 hex/);
  });
});

describe("results", () => {
  it("prints the refusing party's own words", () => {
    const line = formatResult(result({}));
    assert.match(line, /hybrid PQC signature required/);
  });

  it("lists every attack", () => {
    const list = listAttacks();
    for (const id of ["native-transfer", "evm-forward", "vault-redirect", "control-rob"]) assert.ok(list.includes(id), id);
  });

  it("summarises verdicts, counting the control vault as robbed", () => {
    const summary = summarise([
      result({}),
      result({ id: "vault-forged", by: "vault", code: "PqSignatureInvalid" }),
      result({ id: "control-rob", verdict: "succeeded", by: undefined, code: undefined }),
      result({ id: "evm-deploy", verdict: "skipped", ok: true }),
      result({ id: "vault-replay", verdict: "succeeded", ok: false }),
    ]);
    assert.deepEqual(summary, { total: 5, refused: 2, robbed: 1, skipped: 1, unexpected: 1 });
  });

  it("serialises bigints in JSON output", () => {
    assert.equal(JSON.stringify({ loot: 10n ** 18n }, jsonReplacer), '{"loot":"1000000000000000000"}');
  });
});

describe("status", () => {
  it("describes how long ago a block was", () => {
    assert.equal(ago(0n, 100n), "never");
    assert.equal(ago(90n, 100n), "block 90, about 14 s ago");
    assert.equal(ago(1_000n, 1_600n), "block 1000, about 14 min ago");
    assert.equal(ago(1_000n, 11_000n), "block 1000, about 3.9 h ago");
    assert.equal(ago(1_000n, 201_000n), "block 1000, about 3.2 days ago");
  });

  it("finds no problems in a healthy report", () => {
    assert.deepEqual(statusProblems(report()), []);
  });

  it("flags a missing or unproven post-quantum key", () => {
    const base = report();
    assert.match(statusProblems({ ...base, owner: { ...base.owner, pqcRegistered: false } })[0]!, /no ML-DSA-87 key/);
    assert.match(statusProblems({ ...base, owner: { ...base.owner, possessionProven: false } })[0]!, /proof of possession/);
  });

  it("flags an empty or missing hybrid vault", () => {
    assert.match(statusProblems(report({ vaults: [vault({ balance: 0n })] }))[0]!, /empty/);
    assert.match(statusProblems(report({ vaults: [vault({ postQuantum: false })] }))[0]!, /no hybrid vault/);
  });

  it("prints both vaults, the block and the counterfactual loss", () => {
    const text = formatStatus(report());
    for (const piece of ["10066731", "Hybrid vault", "Control vault", "9.999", "39.996", "PqSignatureInvalid"]) {
      assert.ok(text.includes(piece), `missing ${piece}`);
    }
  });
});
