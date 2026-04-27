import { resolveViteApiBase } from "@workspace/api-client-react";

/**
 * Raiz do SPA no domínio (ex.: `/` ou `/casamento360/`).
 * Não use `location.href = "/"` após login em subcaminho — isso abre a home do site principal.
 */
export function getSpaBaseHref(): string {
  const raw = import.meta.env.BASE_URL ?? "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Base da API no browser (ex.: `/api` ou `/casamento360/api` com SPA em subcaminho).
 * Usa a mesma regra que o cliente HTTP (`resolveViteApiBase`).
 */
export function getViteApiBase(): string {
  return resolveViteApiBase();
}

/** Caminho relativo à raiz da API (ex.: `/auth/logout`, `/weddings/1/gifts/upload-image`). */
export function apiFetchPath(pathFromApiRoot: string): string {
  const base = getViteApiBase();
  const p = pathFromApiRoot.startsWith("/") ? pathFromApiRoot : `/${pathFromApiRoot}`;
  return `${base}${p}`;
}

/**
 * URLs de mídia salvas como `/api/uploads/...` precisam do prefixo do app em homolog (ex. `/casamento360/api/...`).
 * URLs gravadas com `APP_BASE_PATH` na API vêm como `/{base}/api/uploads/...`; sem reescrever para a base
 * atual do Vite, em `pnpm dev` (BASE `/`) o browser pede `/{base}/api/...` e o proxy só cobre `/api` — imagem 404.
 * URLs absolutas (http/https/data) e caminhos que não são `/api` nem `/{seg}/api` são mantidos.
 */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (url == null || typeof url !== "string") return "";
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (!u.startsWith("/") || u.startsWith("//")) return u;

  const viteApi = getViteApiBase();
  let rest: string | null = null;
  if (u.startsWith("/api/") || u === "/api") {
    rest = u.slice("/api".length);
  } else {
    const m = u.match(/^(\/[^/]+\/api)(?=\/|$)/);
    if (m) rest = u.slice(m[1].length);
  }

  if (rest !== null) {
    return `${viteApi}${rest}`;
  }
  return u;
}
