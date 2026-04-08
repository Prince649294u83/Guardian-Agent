import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build as esbuild } from "esbuild";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(packageDir, "..");
const outDir = path.resolve(apiDir, ".test-dist");
const entryFile = path.resolve(apiDir, "tests/logic.test.ts");
const bundledFile = path.resolve(outDir, "logic.test.mjs");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await esbuild({
  entryPoints: [entryFile],
  outfile: bundledFile,
  platform: "node",
  bundle: true,
  format: "esm",
  sourcemap: "inline",
  logLevel: "info",
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
globalThis.require = __bannerCrReq(import.meta.url);`,
  },
});

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--test", bundledFile], {
    stdio: "inherit",
    cwd: apiDir,
  });

  child.on("exit", (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`API logic tests failed with exit code ${code ?? -1}`));
  });
  child.on("error", reject);
});
