/**
 * Cria o banco casamento360 no PostgreSQL.
 * Uso: node scripts/create-database-sys-dev.cjs (com `pg` no NODE_PATH ou em node_modules da raiz)
 * Lê variáveis de `../.env` se existir. Env: PGHOST, PGUSER, PGPASSWORD, PGPORT, PG_TARGET_DB
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envFile = path.resolve(__dirname, "../.env");
if (fs.existsSync(envFile)) {
  const raw = fs.readFileSync(envFile, "utf8");
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

const host = process.env.PGHOST ?? "10.1.1.92";
const user = process.env.PGUSER ?? "postgres";
const password = process.env.PGPASSWORD ?? "";
const port = Number(process.env.PGPORT ?? "5432");
const targetDb = process.env.PG_TARGET_DB ?? "casamento360";

if (!password) {
  console.error("Defina PGPASSWORD no ambiente.");
  process.exit(1);
}

(async () => {
  const admin = new Client({
    host,
    user,
    password,
    port,
    database: "postgres",
    ssl: false,
  });
  await admin.connect();
  const exists = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [targetDb],
  );
  if (exists.rows.length === 0) {
    await admin.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
    console.log(`Banco "${targetDb}" criado em ${host}.`);
  } else {
    console.log(`Banco "${targetDb}" já existe em ${host}.`);
  }
  await admin.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
