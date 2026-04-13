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
