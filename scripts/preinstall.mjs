import { rm } from "node:fs/promises";

const userAgent = process.env.npm_config_user_agent ?? "";

await Promise.all([
  rm("package-lock.json", { force: true }),
  rm("yarn.lock", { force: true }),
]);

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
