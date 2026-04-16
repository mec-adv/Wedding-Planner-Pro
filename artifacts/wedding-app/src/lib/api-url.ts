/**
 * Raiz do SPA no domínio (ex.: `/` ou `/casamento360/`).
 * Não use `location.href = "/"` após login em subcaminho — isso abre a home do site principal.
 */
export function getSpaBaseHref(): string {
  const raw = import.meta.env.BASE_URL ?? "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Base da API no browser (ex.: `/api` em dev ou `/casamento360/api` em produção atrás do prefixo).
 * Definir `VITE_API_BASE` no build de produção para coincidir com `APP_BASE_PATH` do Express.
 */
export function getViteApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "/api";
}

/** Caminho relativo à raiz da API (ex.: `/auth/logout`, `/weddings/1/gifts/upload-image`). */
export function apiFetchPath(pathFromApiRoot: string): string {
  const base = getViteApiBase();
  const p = pathFromApiRoot.startsWith("/") ? pathFromApiRoot : `/${pathFromApiRoot}`;
  return `${base}${p}`;
}

/**
 * URLs de mídia salvas como `/api/uploads/...` precisam do prefixo do app em homolog (ex. `/casamento360/api/...`).
 * URLs absolutas (http/https/data) e caminhos já com a base correta são mantidas.
 */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (url == null || typeof url !== "string") return "";
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (u.startsWith("/api/")) {
    const base = getViteApiBase();
    return `${base}${u.slice("/api".length)}`;
  }
  return u;
}
