/**
 * Aplica lib/db/drizzle/0006_public_invite.sql no Postgres (DATABASE_URL).
 * Uso: pnpm exec dotenv -e ../../.env -- node ./scripts/apply-0006-public-invite.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "..", "drizzle", "0006_public_invite.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("Migração 0006_public_invite aplicada com sucesso.");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await pool.end();
}
