import { spawn } from "node:child_process";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const isWindows = process.platform === "win32";
const pnpmExec =
  process.env.npm_execpath && process.env.npm_execpath.toLowerCase().includes("pnpm")
    ? process.env.npm_execpath
    : null;
const nodeBin = process.execPath;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Process terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

if (pnpmExec) {
  await run(nodeBin, [pnpmExec, "--filter", "@workspace/api-server", "run", "build"]);
} else {
  await run(isWindows ? "pnpm.cmd" : "pnpm", ["--filter", "@workspace/api-server", "run", "build"]);
}

const server = spawn(
  nodeBin,
  [path.join("artifacts", "api-server", "dist", "index.mjs")],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "development",
      PORT: process.env.API_PORT ?? process.env.PORT ?? "3001",
    },
    shell: false,
  },
);

server.on("exit", (code) => {
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.kill(signal);
  });
}
