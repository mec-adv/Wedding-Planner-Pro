/**
 * URLs do Google Maps coladas de "Compartilhar" não podem ser usadas em <iframe>
 * (X-Frame-Options / página errada → "conexão recusada"). Só funcionam URLs de
 * "Incorporar mapa" (contêm /maps/embed ou output=embed).
 */

export type MapDisplay =
  | { mode: "iframe"; src: string }
  | { mode: "external"; href: string }
  | null;

function normalizeHttps(url: string): string {
  let u = url.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  if (u.startsWith("http://")) u = `https://${u.slice(7)}`;
  return u;
}

function isGoogleMapsUrl(low: string): boolean {
  return low.includes("google.") && low.includes("/maps");
}

/** URL que o Google permite em iframe de incorporação. */
function isGoogleMapsEmbeddable(u: string): boolean {
  const low = u.toLowerCase();
  if (!isGoogleMapsUrl(low)) return false;
  if (/\/maps\/embed(?:\/|\?|$)/i.test(u)) return true;
  if (/[?&]output=embed(?:&|$|#)/i.test(u)) return true;
  return false;
}

/**
 * Decide se mostramos iframe ou apenas link externo (evita erro no iframe).
 */
export function resolveMapDisplay(raw: string): MapDisplay {
  const t = raw.trim();
  if (!t) return null;
  const u = normalizeHttps(t);
  const low = u.toLowerCase();

  if (isGoogleMapsUrl(low)) {
    if (isGoogleMapsEmbeddable(u)) {
      return { mode: "iframe", src: u };
    }
    return { mode: "external", href: u };
  }

  if (low.includes("openstreetmap") && (low.includes("/export/embed") || low.includes("embed"))) {
    return { mode: "iframe", src: u };
  }

  if (/\/embed\//i.test(u) || /[?&]output=embed/i.test(u)) {
    return { mode: "iframe", src: u };
  }

  return { mode: "external", href: u };
}
