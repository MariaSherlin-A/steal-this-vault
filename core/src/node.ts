/**
 * Node-only helpers: reading secrets from the repository's .env file.
 * Never imported by the site.
 *
 * Secrets:
 *   VAULT_MNEMONIC     the vault owner. Its secp256k1 key is published; this phrase
 *                      and the ML-DSA-87 key derived from it are not.
 *   DEPLOYER_MNEMONIC  a separate account that deploys contracts, so the owner
 *                      account never needs an unscoped EVM window.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The nearest directory at or above `from` that holds the repository's root package.json. */
export function repoRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if ((JSON.parse(readFileSync(pkg, "utf8")) as { name?: string }).name === "steal-this-vault") return dir;
      } catch {
        // keep looking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("could not find the steal-this-vault repository root");
    dir = parent;
  }
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    out[match[1]!] = match[2]!.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return out;
}

/** A secret from the environment, or from .env at the repository root. Undefined when absent. */
export function secret(name: string): string | undefined {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const file = join(repoRoot(), ".env");
  if (!existsSync(file)) return undefined;
  return parseEnv(readFileSync(file, "utf8"))[name]?.trim() || undefined;
}

export function requireSecret(name: string): string {
  const value = secret(name);
  if (!value) throw new Error(`${name} is not set. Put it in .env at the repository root (never commit that file).`);
  return value;
}

/** Append a new secret to .env. Refuses to overwrite one that exists. */
export function saveSecret(name: string, value: string): void {
  if (secret(name)) throw new Error(`${name} already exists; not overwriting it`);
  const file = join(repoRoot(), ".env");
  const prefix = existsSync(file) && !readFileSync(file, "utf8").endsWith("\n") ? "\n" : "";
  appendFileSync(file, `${prefix}${name}="${value}"\n`);
}
