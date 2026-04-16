import express, { type Express, type NextFunction, type Request, type Response } from "express";
import path from "path";
import cors from "cors";
import router from "./routes";
import { getUploadRoot, normalizeAppBasePath } from "./lib/gift-upload-paths";

const app: Express = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/** Sem corpo JSON, o Express pode deixar req.body undefined; rotas que leem req.body.foo quebram antes do spread. */
app.use((req, _res, next) => {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  next();
});

const appBase = normalizeAppBasePath(process.env.APP_BASE_PATH);
const apiRoot = appBase ? `${appBase}/api` : "/api";
const uploadsMount = appBase ? `${appBase}/api/uploads` : "/api/uploads";

app.use(uploadsMount, express.static(getUploadRoot()));
app.use(apiRoot, router);

if (process.env.NODE_ENV === "production") {
  /** Raiz do monorepo = `process.cwd()` (ex.: systemd `WorkingDirectory=/opt/app`). */
  const publicDir = path.join(process.cwd(), "artifacts", "wedding-app", "dist", "public");
  const indexHtml = path.join(publicDir, "index.html");

  if (appBase) {
    app.use(
      appBase,
      express.static(publicDir, {
        index: false,
      }),
    );
    app.use(appBase, (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      res.sendFile(indexHtml, (err) => {
        if (err) next(err);
      });
    });
  } else {
    /** Homologação/produção na raiz (sem `APP_BASE_PATH`): API já está em `/api`. */
    app.use(express.static(publicDir, { index: false }));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexHtml, (err) => {
        if (err) next(err);
      });
    });
  }
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Erro interno";
  res.status(500).json({ error: message });
});

export default app;
