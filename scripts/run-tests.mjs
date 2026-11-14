// Runs every test file under a directory with Node's built-in test runner.
//
//   node scripts/run-tests.mjs <dir> [suffix]
//
// Node 20 does not expand glob patterns given to --test, and neither does
// cmd.exe on Windows, so the files are collected here.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const [dir = "test", suffix = ".test.ts", ...extra] = process.argv.slice(2);

function collect(directory, recursive) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return recursive ? collect(path, true) : [];
    return name.endsWith(suffix) ? [path] : [];
  });
}

const files = collect(resolve(dir), false).sort();
if (files.length === 0) {
  console.error(`no files ending in ${suffix} under ${dir}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-reporter=spec", ...extra, ...files],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
