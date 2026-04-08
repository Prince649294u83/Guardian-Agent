import { spawn } from "node:child_process";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const isWindows = process.platform === "win32";
const pnpmExec =
  process.env.npm_execpath && process.env.npm_execpath.toLowerCase().includes("pnpm")
    ? process.env.npm_execpath
    : null;
const nodeBin = process.execPath;

const children = [];

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

function startProcess(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...env,
    },
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
}

const apiPort = process.env.API_PORT ?? "3001";
const webPort = process.env.WEB_PORT ?? "3000";

const backend = startProcess("backend", nodeBin, ["scripts/dev-api.mjs"], {
  API_PORT: apiPort,
});

const frontend = startProcess(
  "frontend",
  pnpmExec ? nodeBin : isWindows ? "pnpm.cmd" : "pnpm",
  pnpmExec
    ? [pnpmExec, "--filter", "@workspace/guardian-agent", "run", "dev"]
    : ["--filter", "@workspace/guardian-agent", "run", "dev"],
  {
    PORT: webPort,
    BASE_PATH: "/",
    API_BASE_URL: `http://127.0.0.1:${apiPort}`,
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    backend.kill(signal);
    frontend.kill(signal);
    process.exit(0);
  });
}
