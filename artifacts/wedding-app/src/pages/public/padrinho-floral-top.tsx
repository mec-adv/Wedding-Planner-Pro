/** Decoração acima de cada avatar de padrinho: imagem opcional ou divisor floral SVG (símbolos em `botanico-floral-defs`). */

import { resolveMediaUrl } from "@/lib/api-url";

export function PadrinhoFloralTop({
  variant,
  flourishUrl,
}: {
  variant: number;
  flourishUrl?: string;
}) {
  const u = resolveMediaUrl(flourishUrl?.trim());
  if (u) {
    return (
      <div className="flex justify-center mb-2 h-11">
        <img src={u} alt="" className="h-11 w-auto max-w-[140px] object-contain" loading="lazy" decoding="async" />
      </div>
    );
  }
  const op = [0.88, 0.92, 0.85, 0.9, 0.87][variant % 5];
  return (
    <div className="flex justify-center mb-2 h-11" style={{ opacity: op }}>
      <svg width="140" height="28" viewBox="0 0 340 60" aria-hidden className="max-w-[140px]">
        <use href="#floralDivider" x="0" y="0" width="340" height="60" />
      </svg>
    </div>
  );
}
