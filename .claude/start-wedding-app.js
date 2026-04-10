// Wrapper: Wedding App frontend (Vite, porta 5173)
// Instala dependências se necessário, depois sobe o servidor de dev.
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const env = { ...process.env, PORT: "5173", BASE_PATH: "/" };

// Instala dependências se node_modules não existir
const nm = path.join(root, "artifacts", "wedding-app", "node_modules");
if (!fs.existsSync(nm)) {
  console.log("[launch] node_modules ausente — rodando pnpm install...");
  const install = spawnSync("npx", ["--yes", "pnpm@9", "install"], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env,
  });
  if (install.status !== 0) {
    console.error("[launch] pnpm install falhou.");
    process.exit(install.status ?? 1);
  }
}

const proc = spawn(
  "npx",
  ["--yes", "pnpm@9", "--filter", "@workspace/wedding-app", "run", "dev"],
  { stdio: "inherit", shell: true, cwd: root, env }
);

proc.on("exit", (code) => process.exit(code ?? 0));
