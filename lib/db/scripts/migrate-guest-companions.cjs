/**
 * Executa lib/db/drizzle/0004_guest_companions.sql
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "../drizzle/0004_guest_companions.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new Pool({ connectionString: url });
pool
  .query(sql)
  .then(() => {
    console.log("Migração guest_companions aplicada.");
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
