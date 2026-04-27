import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

/** Prefixo público sem barra final, ex.: `""` (raiz) ou `"/casamento360"`. */
const pathPrefix = basePath === "/" ? "" : basePath.replace(/\/+$/, "");
/** Base da API no browser; em subcaminho deve ser `/prefixo/api` para bater com APP_BASE_PATH da API. */
const defaultViteApiBase = pathPrefix === "" ? "/api" : `${pathPrefix}/api`;

/** Monorepo root: `.env` com PORT/DEV_API_PORT da API fica na raiz, não em `artifacts/wedding-app`. */
const monorepoRoot = path.resolve(import.meta.dirname, "..", "..");
const viteMode = process.env.NODE_ENV === "production" ? "production" : "development";
const rootEnv = loadEnv(viteMode, monorepoRoot, "");

const envViteApiBase = rootEnv.VITE_API_BASE?.trim();
/** Chave do proxy deve coincidir com `resolveViteApiBase()` (BASE_URL + `/api`). Evita `VITE_API_BASE=/api` com app em subcaminho. */
const viteApiBase =
  pathPrefix !== "" && (!envViteApiBase || envViteApiBase === "/api")
    ? defaultViteApiBase
    : envViteApiBase || defaultViteApiBase;

/** Porta do Express em dev; o Vite usa outra PORT (ex.: 5173). */
const devApiPort = rootEnv.DEV_API_PORT || process.env.DEV_API_PORT || "8080";
const devApiProxyTarget = `http://127.0.0.1:${devApiPort}`;

/** Em dev com subcaminho, o browser chama `/{prefix}/api/...`; o Express local monta em `/api`. */
function rewriteDevProxyToApiRoot(path: string): string {
  if (pathPrefix === "") return path;
  const escaped = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return path.replace(new RegExp(`^${escaped}/api`), "/api");
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      [viteApiBase]: {
        target: devApiProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: rewriteDevProxyToApiRoot,
      },
      // Fallback: mídias antigas ou links `/api/uploads/...` na raiz do host (sem prefixo do app).
      ...(pathPrefix !== ""
        ? {
            "^/api": {
              target: devApiProxyTarget,
              changeOrigin: true,
            },
          }
        : {}),
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
