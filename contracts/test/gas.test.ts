/**
 * What each outcome costs. The local precompiles charge the chain's documented
 * schedule (25,000 + 8 per input byte for verification, 2,500 for key status),
 * so these figures estimate testnet gas. The live suite measures the real ones.
 *
 * The bounds matter: an attempt that is obviously going nowhere must be cheap,
 * because inside an EVM window it is the owner's fee budget that pays for it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toHex } from "viem";
import { deployWorld, intentFor, ownerSigns, withdraw } from "./harness/fixture";

describe("vault: gas", () => {
  it("cheap refusals stay cheap; only a full-size signature reaches the verifier", async () => {
    const w = await deployWorld();
    const rows: [string, bigint][] = [];
    const measure = async (label: string, run: () => ReturnType<typeof withdraw>) => {
      // The first refusal initialises storage slots; measure the steady state.
      await run();
      const tx = await run();
      rows.push([label, tx.gasUsed]);
      return tx.gasUsed;
    };

    const intent = await intentFor(w, w.hybrid);
    const noKey = await measure("refused: stranger, no signatures", () => withdraw(w.hybrid, w.stranger, intent));
    const noPq = await measure("refused: owner account, no post-quantum signature", () => withdraw(w.hybrid, w.owner, intent));
    const forged = await measure("refused: owner account, forged 4627-byte signature", () =>
      withdraw(w.hybrid, w.owner, intent, "0x", toHex(new Uint8Array(4627).fill(7))),
    );

    const signed = await ownerSigns(w, w.hybrid, intent);
    const paid = await withdraw(w.hybrid, w.stranger, intent, signed.classicalSignature, signed.postQuantumSignature);
    rows.push(["paid: hybrid vault, both signatures, via relayer", paid.gasUsed]);
    const control = await withdraw(w.classic, w.owner, await intentFor(w, w.classic));
    rows.push(["paid: control vault, owner account", control.gasUsed]);

    console.log("\n  gas per transaction (local EVM, chain's precompile schedule)");
    for (const [label, gas] of rows) console.log(`    ${gas.toString().padStart(8)}  ${label}`);
    console.log();

    assert.ok(noKey < 90_000n, `no-key refusal: ${noKey}`);
    assert.ok(noPq < 90_000n, `no-pq refusal: ${noPq}`);
    assert.ok(forged > noPq + 100_000n, "the forged signature pays for calldata and one verification");
    assert.ok(forged < 330_000n, `forged refusal: ${forged}`);
    assert.ok(paid.gasUsed < 360_000n, `paid: ${paid.gasUsed}`);
    assert.ok(control.gasUsed < 170_000n, `control paid: ${control.gasUsed}`);
  });
});
