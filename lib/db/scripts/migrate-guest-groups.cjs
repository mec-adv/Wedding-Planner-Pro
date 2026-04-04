/**
 * Executa lib/db/drizzle/0003_guest_groups.sql (preserva group_name → guest_groups).
 * Use antes do primeiro `pnpm db:push` se o Drizzle perguntar sobre guest_group_id.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "../drizzle/0003_guest_groups.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new Pool({ connectionString: url });
pool
  .query(sql)
  .then(() => {
    console.log("Migração guest_groups aplicada.");
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
