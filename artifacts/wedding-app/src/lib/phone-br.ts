/** Remove não-dígitos e limita a 11 (celular BR). */
export function stripPhoneDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

/** Formata para exibição: (DD) NNNNN-NNNN ou (DD) NNNN-NNNN. */
export function displayPhoneBr(digits: string): string {
  const d = stripPhoneDigits(digits);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Normaliza valor já salvo (só dígitos ou texto antigo) para exibição. */
export function formatPhoneBrReadOnly(stored: string | null | undefined): string {
  if (!stored) return "";
  return displayPhoneBr(stored);
}
