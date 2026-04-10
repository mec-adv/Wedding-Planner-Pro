// Wrapper: API Server (Express, porta 8080)
// PORT vem do .env via dotenv (load-env.ts no api-server)
// Instala dependências se node_modules estiver ausente.
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");

// Instala dependências se node_modules não existir
const nm = path.join(root, "artifacts", "api-server", "node_modules");
if (!fs.existsSync(nm)) {
  console.log("[launch] node_modules ausente — rodando pnpm install...");
  const install = spawnSync("npx", ["--yes", "pnpm@9", "install"], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env: process.env,
  });
  if (install.status !== 0) {
    console.error("[launch] pnpm install falhou.");
    process.exit(install.status ?? 1);
  }
}

const proc = spawn(
  "npx",
  ["--yes", "pnpm@9", "--filter", "@workspace/api-server", "run", "dev"],
  { stdio: "inherit", shell: true, cwd: root, env: process.env }
);

proc.on("exit", (code) => process.exit(code ?? 0));
