// Vercel build step (runs on Linux). Order: prisma generate -> migrate -> seed -> next build.
// If DATABASE_URL/DIRECT_URL are not configured yet (deploy-before-DB), migrate/seed are
// skipped so the deployment still succeeds; a later deploy with env vars set automatically
// picks up the full path (generate Postgres client + migrate deploy + seed).
import { spawnSync } from "node:child_process";

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DIRECT_URL);

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

if (hasDb) {
  run("npx", ["prisma", "generate", "--schema", "prisma/postgres/schema.prisma"]);
  run("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
} else {
  console.warn(
    "DATABASE_URL/DIRECT_URL not set — skipping migrate/seed and building without a database. " +
      "Add the env vars and redeploy to complete setup."
  );
  run("npx", ["prisma", "generate"]);
}

run("npx", ["next", "build"]);
