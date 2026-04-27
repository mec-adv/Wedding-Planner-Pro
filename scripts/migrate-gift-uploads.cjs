/**
 * Migra arquivos de presentes de uploads/.../gifts/ para .../gift/ e atualiza image_url na tabela gifts.
 *
 * Uso (na raiz do monorepo): node scripts/migrate-gift-uploads.cjs
 * Requer: DATABASE_URL ou variáveis do Postgres no .env (como os outros scripts).
 * Idempotente: pode rodar de novo; só altera o que ainda contém /gifts/.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  for (let n = 0; n < 12; n++) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir, "..", "..");
}

function getUploadRoot() {
  const fromEnv = process.env.UPLOAD_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(findWorkspaceRoot(__dirname), "uploads");
}

async function moveGiftsDirsToGift(uploadRoot) {
  const usersDir = path.join(uploadRoot, "users");
  if (!fs.existsSync(usersDir)) {
    console.log("[fs] Nenhuma pasta uploads/users — nada a mover.");
    return { movedFiles: 0, dirsRenamed: 0 };
  }

  let movedFiles = 0;

  const walkUser = async (userPath) => {
    const entries = await fs.promises.readdir(userPath, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const eventPath = path.join(userPath, ent.name);
      const giftsPath = path.join(eventPath, "gifts");
      const giftPath = path.join(eventPath, "gift");

      if (!fs.existsSync(giftsPath)) continue;

      await fs.promises.mkdir(giftPath, { recursive: true });
      const files = await fs.promises.readdir(giftsPath);
      for (const name of files) {
        const from = path.join(giftsPath, name);
        const to = path.join(giftPath, name);
        const st = await fs.promises.stat(from);
        if (!st.isFile()) continue;
        if (fs.existsSync(to)) {
          console.warn(`[fs] Destino já existe, pulando: ${to}`);
          continue;
        }
        await fs.promises.rename(from, to);
        movedFiles += 1;
      }

      const left = await fs.promises.readdir(giftsPath);
      if (left.length === 0) {
        await fs.promises.rmdir(giftsPath);
        console.log(`[fs] Removida pasta vazia: ${giftsPath}`);
      } else {
        console.warn(`[fs] Pasta gifts não vazia após migração: ${giftsPath}`);
      }
    }
  };

  const userIds = await fs.promises.readdir(usersDir);
  for (const uid of userIds) {
    const userPath = path.join(usersDir, uid);
    const st = await fs.promises.stat(userPath).catch(() => null);
    if (!st?.isDirectory()) continue;
    await walkUser(userPath);
  }

  console.log(`[fs] Arquivos movidos: ${movedFiles}`);
  return { movedFiles };
}

async function updateDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL no .env");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const r = await client.query(`
      UPDATE gifts
      SET image_url = REPLACE(image_url, '/gifts/', '/gift/')
      WHERE image_url IS NOT NULL
        AND image_url LIKE '%/gifts/%'
    `);
    console.log(`[db] Linhas atualizadas em gifts.image_url: ${r.rowCount ?? 0}`);
  } finally {
    await client.end();
  }
}

async function main() {
  loadEnvFile(path.resolve(__dirname, "../.env"));

  const uploadRoot = getUploadRoot();
  console.log(`[fs] UPLOAD_ROOT = ${uploadRoot}`);

  await moveGiftsDirsToGift(uploadRoot);
  await updateDatabase();

  console.log("Concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
