/**
 * Base da API no browser (`/api` na raiz ou `/{prefixo}/api` com SPA em subcaminho).
 *
 * Deriva **só** de `import.meta.env.BASE_URL` (Vite preenche a partir de `base` no vite.config).
 * Assim mídias e fetch batem com o proxy em homolog (`/casamento360/api/...`).
 */
export function resolveViteApiBase(): string {
  const baseUrlRaw =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL).replace(/\/+$/, "")
      : "";

  const spaPath =
    !baseUrlRaw || baseUrlRaw === "/"
      ? "/"
      : baseUrlRaw.startsWith("/")
        ? baseUrlRaw
        : `/${baseUrlRaw}`;

  return spaPath === "/" ? "/api" : `${spaPath}/api`;
}
