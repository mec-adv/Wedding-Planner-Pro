/**
 * Prova reproduzível: o patch antigo em App.tsx fazia
 *   headers = { ...init.headers, Authorization: ... }
 * com init.headers sendo um objeto Headers(). O spread de Headers no JS
 * não copia Content-Type → express.json() não parseia o corpo.
 */
const h = new Headers();
h.set("Content-Type", "application/json");
h.set("Accept", "application/json");
const broken = { ...h };
const keys = Object.keys(broken);
if (keys.length !== 0) {
  console.error("FAIL: esperado spread de Headers vazio, obteve:", keys);
  process.exit(1);
}
console.log("OK: spread de Headers() → {} (Content-Type seria perdido no patch antigo)");

const fixed = new Headers(h);
fixed.set("Authorization", "Bearer x");
if (fixed.get("Content-Type") !== "application/json") {
  console.error("FAIL: Content-Type perdido após merge com Headers API");
  process.exit(1);
}
console.log("OK: new Headers(init.headers).set('Authorization',…) preserva Content-Type");
