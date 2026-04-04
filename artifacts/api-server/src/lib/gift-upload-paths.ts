import path from "path";
import fs from "fs/promises";
import fsSync from "fs";

export const PUBLIC_UPLOAD_URL_PREFIX = "/api/uploads";

export function getUploadRoot(): string {
  const fromEnv = process.env.UPLOAD_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "../../uploads");
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
  return `${PUBLIC_UPLOAD_URL_PREFIX}/${normalized}`;
}

export function isManagedGiftImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  return u.startsWith(`${PUBLIC_UPLOAD_URL_PREFIX}/`);
}

export function managedUrlToAbsoluteFilePath(url: string): string | null {
  if (!isManagedGiftImageUrl(url)) return null;
  const withoutQuery = (url.split("?")[0] ?? "").trim();
  const prefix = `${PUBLIC_UPLOAD_URL_PREFIX}/`;
  const idx = withoutQuery.indexOf(prefix);
  if (idx === -1) return null;
  const after = withoutQuery.slice(idx + prefix.length);
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
