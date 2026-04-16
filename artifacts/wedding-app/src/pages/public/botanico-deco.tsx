import type { ResolvedPublicInvitePageConfig } from "./public-invite-page-config";
import { resolveMediaUrl } from "@/lib/api-url";

type BotanicoDecoProps = {
  cfg: ResolvedPublicInvitePageConfig;
  /** Campo opcional em `cfg` com URL de imagem raster (PNG/WebP); se vazio, usa símbolo SVG inline. */
  rasterKey:
    | "botanicoDividerUrl"
    | "botanicoHeroGarlandUrl"
    | "botanicoColumnFloralUrl"
    | "botanicoCornerFloralUrl"
    | "botanicoFooterGarlandUrl";
  symbolId: "floralDivider" | "heroGarland" | "bouquetLeft" | "cornerTL" | "footerGarland";
  vbW: number;
  vbH: number;
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
};

export function BotanicoDeco({
  cfg,
  rasterKey,
  symbolId,
  vbW,
  vbH,
  className,
  imgClassName,
  loading = "lazy",
}: BotanicoDecoProps) {
  const url = resolveMediaUrl((cfg[rasterKey] as string | undefined)?.trim());
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={imgClassName ?? className}
        loading={loading}
        decoding="async"
      />
    );
  }
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className={className} aria-hidden>
      <use href={`#${symbolId}`} x="0" y="0" width={vbW} height={vbH} />
    </svg>
  );
}
