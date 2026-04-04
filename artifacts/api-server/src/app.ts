import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes";
import { getUploadRoot } from "./lib/gift-upload-paths";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/** Sem corpo JSON, o Express pode deixar req.body undefined; rotas que leem req.body.foo quebram antes do spread. */
app.use((req, _res, next) => {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  next();
});

app.use("/api/uploads", express.static(getUploadRoot()));
app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Erro interno";
  res.status(500).json({ error: message });
});

export default app;
