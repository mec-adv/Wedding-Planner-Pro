import path from "path";
import fs from "fs/promises";
import fsSync from "fs";

function findWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);
  for (;;) {
    const marker = path.join(current, "pnpm-workspace.yaml");
    if (fsSync.existsSync(marker)) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDir);
    current = parent;
  }
}

export function normalizeAppBasePath(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();
  if (trimmed === "/") return "";
  return trimmed.replace(/\/+$/, "");
}

/** Prefixo público para arquivos (ex.: `/api/uploads` ou `/casamento360/api/uploads`). */
export function getPublicUploadUrlPrefix(): string {
  const base = normalizeAppBasePath(process.env.APP_BASE_PATH);
  return base ? `${base}/api/uploads` : "/api/uploads";
}

export function getUploadRoot(): string {
  const fromEnv = process.env.UPLOAD_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  return path.join(workspaceRoot, "uploads");
}

export function slugifyTitle(title: string, maxLen = 80): string {
  const ascii = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const s = ascii.slice(0, maxLen).replace(/-+$/g, "");
  return s || "evento";
}

/** Segmentos relativos ao root de upload: users/{id}/{slug}-w{wid} */
export function getWeddingEventRelativePath(weddingId: number, createdById: number, title: string): string {
  const slug = slugifyTitle(title);
  return path.join("users", String(createdById), `${slug}-w${weddingId}`);
}

export function getWeddingEventAbsolutePath(weddingId: number, createdById: number, title: string): string {
  return path.join(getUploadRoot(), getWeddingEventRelativePath(weddingId, createdById, title));
}

export function getWeddingGiftDirAbsolute(weddingId: number, createdById: number, title: string): string {
  return path.join(getWeddingEventAbsolutePath(weddingId, createdById, title), "gifts");
}

export function getPublicUrlForRelativeKey(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  return `${getPublicUploadUrlPrefix()}/${normalized}`;
}

const LEGACY_UPLOAD_PREFIX = "/api/uploads";

function uploadKeyAfterPrefix(withoutQuery: string): string | null {
  const prefixes = [getPublicUploadUrlPrefix(), LEGACY_UPLOAD_PREFIX];
  for (const prefix of prefixes) {
    const mark = `${prefix}/`;
    if (withoutQuery.startsWith(mark)) {
      return withoutQuery.slice(mark.length);
    }
  }
  return null;
}

export function isManagedGiftImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const u = (url.split("?")[0] ?? "").trim();
  return uploadKeyAfterPrefix(u) != null;
}

export function managedUrlToAbsoluteFilePath(url: string): string | null {
  if (!isManagedGiftImageUrl(url)) return null;
  const withoutQuery = (url.split("?")[0] ?? "").trim();
  const after = uploadKeyAfterPrefix(withoutQuery);
  if (!after || after.includes("..")) return null;
  return path.join(getUploadRoot(), ...after.split("/"));
}

export async function unlinkManagedGiftImage(url: string | null | undefined): Promise<void> {
  const abs = url ? managedUrlToAbsoluteFilePath(url) : null;
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.warn("[gift-upload] unlink", e);
  }
}

export function extFromMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return null;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function removeWeddingUploadDirectory(
  weddingId: number,
  createdById: number,
  title: string,
): Promise<void> {
  const dir = getWeddingEventAbsolutePath(weddingId, createdById, title);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (e) {
    console.warn("[gift-upload] rm wedding dir", dir, e);
  }
}

/** Garante que o root de upload exista (útil na primeira escrita). */
export function ensureUploadRootExists(): void {
  const root = getUploadRoot();
  if (!fsSync.existsSync(root)) {
    fsSync.mkdirSync(root, { recursive: true });
  }
}
