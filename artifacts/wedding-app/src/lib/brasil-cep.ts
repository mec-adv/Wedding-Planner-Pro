/** Resposta da Brasil API — CEP v1 */
export type BrasilApiCepV1 = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
};

export function onlyCepDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function formatCepDisplay(digits: string): string {
  const d = onlyCepDigits(digits);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Consulta CEP na Brasil API (sem autenticação). */
export async function fetchAddressByCep(raw: string): Promise<BrasilApiCepV1 | null> {
  const digits = onlyCepDigits(raw);
  if (digits.length !== 8) return null;
  const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
  if (!res.ok) return null;
  try {
    return (await res.json()) as BrasilApiCepV1;
  } catch {
    return null;
  }
}
