/** Decoração SVG fixa acima de cada avatar de padrinho (5 variantes do layout botânico). */

export function PadrinhoFloralTop({ variant }: { variant: number }) {
  const v = variant % 5;
  if (v === 0) {
    return (
      <div className="flex justify-center mb-2 h-11">
        <svg width="120" height="44" viewBox="0 0 200 80" aria-hidden>
          <use href="#roseYellowSm" x="80" y="4" width="40" height="40" />
          <use href="#flowerBlueSm" x="30" y="14" width="32" height="32" />
          <use href="#flowerBlueSm" x="138" y="14" width="32" height="32" />
          <use href="#leafSm" x="60" y="20" width="18" height="28" transform="rotate(-20 69 34)" />
          <use href="#leafSm" x="122" y="20" width="18" height="28" transform="rotate(20 131 34)" />
          <use href="#budYellow" x="14" y="26" width="14" height="22" />
          <use href="#budBlue" x="172" y="26" width="13" height="20" />
        </svg>
      </div>
    );
  }
  if (v === 1) {
    return (
      <div className="flex justify-center mb-2 h-11">
        <svg width="120" height="44" viewBox="0 0 200 80" aria-hidden>
          <use href="#flowerBlueLg" x="74" y="0" width="52" height="52" />
          <use href="#roseYellowSm" x="20" y="10" width="36" height="36" />
          <use href="#roseYellowSm" x="144" y="10" width="36" height="36" />
          <use href="#leafOval" x="58" y="18" width="20" height="30" transform="rotate(-15 68 33)" />
          <use href="#leafOval" x="122" y="18" width="20" height="30" transform="rotate(15 132 33)" />
          <use href="#budBlue" x="8" y="28" width="13" height="20" />
          <use href="#budYellow" x="178" y="28" width="13" height="20" />
        </svg>
      </div>
    );
  }
  if (v === 2) {
    return (
      <div className="flex justify-center mb-2 h-11">
        <svg width="120" height="44" viewBox="0 0 200 80" aria-hidden>
          <use href="#roseYellowLg" x="74" y="-4" width="52" height="52" />
          <use href="#flowerBlueSm" x="24" y="12" width="34" height="34" />
          <use href="#flowerBlueSm" x="142" y="12" width="34" height="34" />
          <use href="#leafSm" x="56" y="16" width="18" height="28" transform="rotate(-25 65 30)" />
          <use href="#leafSm" x="126" y="16" width="18" height="28" transform="rotate(25 135 30)" />
          <use href="#budYellow" x="10" y="26" width="14" height="22" />
          <use href="#budBlue" x="174" y="26" width="13" height="20" />
        </svg>
      </div>
    );
  }
  if (v === 3) {
    return (
      <div className="flex justify-center mb-2 h-11">
        <svg width="120" height="44" viewBox="0 0 200 80" aria-hidden>
          <use href="#flowerBlueLg" x="74" y="0" width="52" height="52" />
          <use href="#roseYellowSm" x="28" y="10" width="36" height="36" />
          <use href="#roseYellowSm" x="136" y="10" width="36" height="36" />
          <use href="#leafLg" x="52" y="14" width="22" height="35" transform="rotate(-20 63 32)" />
          <use href="#leafLg" x="126" y="14" width="22" height="35" transform="rotate(20 137 32)" />
          <use href="#budBlue" x="10" y="28" width="14" height="22" />
          <use href="#budYellow" x="176" y="28" width="13" height="20" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex justify-center mb-2 h-11">
      <svg width="120" height="44" viewBox="0 0 200 80" aria-hidden>
        <use href="#roseYellowSm" x="80" y="4" width="40" height="40" />
        <use href="#flowerBlueLg" x="24" y="8" width="48" height="48" />
        <use href="#flowerBlueLg" x="128" y="8" width="48" height="48" />
        <use href="#leafOval" x="64" y="18" width="18" height="28" transform="rotate(-12 73 32)" />
        <use href="#leafOval" x="118" y="18" width="18" height="28" transform="rotate(12 127 32)" />
        <use href="#budYellow" x="8" y="28" width="14" height="22" />
        <use href="#budBlue" x="178" y="28" width="13" height="20" />
      </svg>
    </div>
  );
}
