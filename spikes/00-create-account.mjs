// Spike 0: create the vault owner account.
// Writes the mnemonic to ../.env (gitignored). Prints addresses only, never secrets.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateMnemonic, deriveUnifiedAccount } from "@qorechain/sdk";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

let mnemonic = existing.match(/^VAULT_MNEMONIC="(.+)"$/m)?.[1];
if (!mnemonic) {
  mnemonic = generateMnemonic(256); // 24 words
  writeFileSync(envPath, `${existing}VAULT_MNEMONIC="${mnemonic}"\n`);
  console.log("created a new mnemonic in .env");
} else {
  console.log("reusing the mnemonic already in .env");
}

const account = await deriveUnifiedAccount(mnemonic);
// Show the shape of the account object without revealing secret values.
const shape = Object.fromEntries(
  Object.entries(account).map(([k, v]) => [
    k,
    /priv|secret|mnemonic|seed/i.test(k)
      ? "<hidden>"
      : typeof v === "object" && v !== null
        ? Object.fromEntries(
            Object.entries(v).map(([k2, v2]) => [
              k2,
              /priv|secret|mnemonic|seed/i.test(k2)
                ? "<hidden>"
                : v2 instanceof Uint8Array
                  ? `<${v2.length} bytes>`
                  : typeof v2 === "function"
                    ? "<fn>"
                    : v2,
            ]),
          )
        : v instanceof Uint8Array
          ? `<${v.length} bytes>`
          : v,
  ]),
);
console.log(JSON.stringify(shape, null, 2));
