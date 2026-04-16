import path from "path";
import { existsSync } from "fs";
import { config } from "dotenv";

/** Sobe a partir de `process.cwd()` até achar `.env` (raiz do monorepo em deploy típico). Compatível com bundle CJS (sem `import.meta`). */
function resolveEnvFile(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), ".env");
}

config({ path: resolveEnvFile() });
