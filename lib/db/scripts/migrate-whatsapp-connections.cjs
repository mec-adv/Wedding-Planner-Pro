/**
 * Aplica lib/db/drizzle/0004_whatsapp_connections.sql quando o banco ainda não tem
 * a tabela whatsapp_connections (ex.: deploy sem `drizzle-kit push`).
 *
 * Uso: na raiz do monorepo, com DATABASE_URL no .env:
 *   pnpm --filter @workspace/db migrate-whatsapp-connections
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "../drizzle/0004_whatsapp_connections.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new Pool({ connectionString: url });
pool
  .query(sql)
  .then(() => {
    console.log("Migração whatsapp_connections aplicada.");
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
