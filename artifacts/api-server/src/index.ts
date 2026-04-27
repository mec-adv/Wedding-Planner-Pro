import "./load-env";
import app from "./app";
import { migrateLegacyWhatsappInstances } from "./lib/migrate-whatsapp-connections";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

migrateLegacyWhatsappInstances().catch((err: unknown) => {
  console.warn(
    "[whatsapp-migrate] Falha ao executar migração legada:",
    err instanceof Error ? err.message : String(err),
  );
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
