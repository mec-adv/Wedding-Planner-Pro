/**
 * Executa lib/db/drizzle/0009_wedding_contact_venues.sql
 * (colunas JSONB groom_contact, bride_contact, religious_venue_detail, civil_venue_detail).
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "../drizzle/0009_wedding_contact_venues.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new Pool({ connectionString: url });
pool
  .query(sql)
  .then(() => {
    console.log("Migração wedding_contact_venues aplicada.");
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
