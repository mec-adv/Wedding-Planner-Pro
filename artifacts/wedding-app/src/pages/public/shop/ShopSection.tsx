import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Heart, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/api-url";
import {
  fetchShopGifts, fetchShopCategories, fetchShopSettings,
} from "@/lib/shop-api";
import type { ShopGift, CartItem } from "@/lib/shop-api";
import type { PublicInvitePageConfig } from "../public-invite-page-config";
import { HoneymoonFundModal } from "./HoneymoonFundModal";
import { useToast } from "@/hooks/use-toast";

type SortOption = "default" | "asc" | "desc" | "name";

const PAGE_SIZE = 12;

interface ShopSectionProps {
  cfg: PublicInvitePageConfig;
  primaryColor: string;
  weddingId: number;
  onAddItem: (item: CartItem) => void;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ShopCoupleCarousel({ imageUrls, primaryColor }: { imageUrls: string[]; primaryColor: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const showNav = imageUrls.length > 1;

  return (
    <div className="relative w-full overflow-hidden bg-neutral-900">
      <Carousel
        setApi={setApi}
        opts={{ loop: showNav, align: "start" }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {imageUrls.map((url, i) => (
            <CarouselItem key={i} className="pl-0 basis-full">
              <div className="w-full h-[min(46vh,520px)] min-h-[240px] sm:min-h-[300px] lg:min-h-[380px] bg-neutral-800">
                <img
                  src={resolveMediaUrl(url)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {showNav && (
          <>
            <CarouselPrevious
              className="left-2 sm:left-4 border-white/30 bg-black/35 text-white hover:bg-black/50 shadow-none backdrop-blur-[2px]"
              aria-label="Foto anterior"
            />
            <CarouselNext
              className="right-2 sm:right-4 border-white/30 bg-black/35 text-white hover:bg-black/50 shadow-none backdrop-blur-[2px]"
              aria-label="Próxima foto"
            />
          </>
        )}
      </Carousel>
      {showNav && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-4 pt-16 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
          aria-hidden
        >
          <div className="pointer-events-auto flex justify-center gap-1.5">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para foto ${i + 1}`}
                aria-current={current === i ? "true" : undefined}
                className="h-2 rounded-full transition-all shadow-sm ring-1 ring-white/30"
                style={{
                  width: current === i ? 24 : 8,
                  backgroundColor: current === i ? primaryColor : "rgba(255,255,255,0.45)",
                }}
                onClick={() => api?.scrollTo(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ShopSection({
  cfg,
  primaryColor,
  weddingId,
  onAddItem,
}: ShopSectionProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const [honeymoonGift, setHoneymoonGift] = useState<ShopGift | null>(null);

  const { data: giftsData, isLoading: giftsLoading } = useQuery({
    queryKey: ["shop-gifts", weddingId],
    queryFn: () => fetchShopGifts(weddingId),
    enabled: !!weddingId,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["shop-categories", weddingId],
    queryFn: () => fetchShopCategories(weddingId),
    enabled: !!weddingId,
  });

  const { data: shopSettings } = useQuery({
    queryKey: ["shop-settings", weddingId],
    queryFn: () => fetchShopSettings(weddingId),
    enabled: !!weddingId,
  });

  const gifts = giftsData?.gifts ?? [];
  const categories = categoriesData?.categories ?? [];

  const carouselUrls = useMemo(() => {
    const raw = cfg.shopCarouselImageUrls;
    if (!raw?.length) return [] as string[];
    return raw.slice(0, 3).filter((u) => typeof u === "string" && u.trim() !== "");
  }, [cfg.shopCarouselImageUrls]);

  const filtered = useMemo(() => {
    const catName = activeCategory !== null
      ? categories.find((c) => c.id === activeCategory)?.name
      : null;

    let list = gifts.filter((g) => {
      if (catName !== null && g.category !== catName) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return g.name.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q);
    });

    if (sort === "asc") list = [...list].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sort === "desc") list = [...list].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return list;
  }, [gifts, search, activeCategory, sort, categories]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [search, activeCategory, sort, weddingId]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function handleAddNormal(gift: ShopGift) {
    onAddItem({
      giftId: gift.id,
      name: gift.name,
      unitPrice: parseFloat(gift.price),
      quantity: 1,
      isHoneymoonFund: false,
    });
    toast({ title: `"${gift.name}" adicionado ao carrinho` });
  }

  const progressPct = shopSettings?.showProgressBar && shopSettings.progressGoal
    ? Math.min(100, Math.round(((shopSettings.totalRaised ?? 0) / shopSettings.progressGoal) * 100))
    : 0;

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = filtered.length === 0 ? 0 : Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <>
      <section className="border-t border-gray-200" id="presentes">
        {carouselUrls.length > 0 && (
          <ShopCoupleCarousel imageUrls={carouselUrls} primaryColor={primaryColor} />
        )}

        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-10 sm:py-12">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-4xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
              {cfg.giftsSectionTitle}
            </h2>
            <p className="text-lg">{cfg.giftsTagline}</p>
          </div>

          {shopSettings?.showProgressBar && shopSettings.progressGoal && (
            <div className="mb-6 sm:mb-8 bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-sm text-gray-600">Arrecadação da lista</span>
                <span
                  className="text-2xl font-semibold tabular-nums"
                  style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
                >
                  {progressPct}%
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${primaryColor}22` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: primaryColor }} />
              </div>
            </div>
          )}

          {!giftsLoading && gifts.length > 0 && (
            <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar presente por nome"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {categories.length > 0 && (
                  <select
                    className="w-full sm:flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[color:var(--invite-primary)]"
                    value={activeCategory ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setActiveCategory(v === "" ? null : Number(v));
                    }}
                    aria-label="Filtrar por categoria"
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  className="w-full sm:flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[color:var(--invite-primary)]"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  aria-label="Ordenar lista"
                >
                  <option value="default">Ordem da lista</option>
                  <option value="name">Nome (A–Z)</option>
                  <option value="asc">Menor valor</option>
                  <option value="desc">Maior valor</option>
                </select>
              </div>
            </div>
          )}

          {giftsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-44 sm:h-48 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 italic py-12">{cfg.giftsEmptyMessage}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {pageSlice.map((gift) => {
                  const price = parseFloat(gift.price);
                  if (gift.isHoneymoonFund) {
                    return (
                      <div
                        key={gift.id}
                        className="relative flex flex-col rounded-lg overflow-hidden shadow-sm border-2 bg-white"
                        style={{ borderColor: primaryColor }}
                      >
                        <div className="p-3 sm:p-4 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Heart className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide leading-tight" style={{ color: primaryColor }}>Cota de Lua de Mel</span>
                          </div>
                          <h3 className="text-base sm:text-lg mb-1 leading-snug" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>{gift.name}</h3>
                          {gift.description && <p className="text-xs sm:text-sm text-gray-500 line-clamp-3 flex-1">{gift.description}</p>}
                          {gift.humorTag ? (
                            <div className="mt-2 rounded-md border px-2 py-1.5 text-xs italic leading-snug" style={{ borderColor: `${primaryColor}44`, backgroundColor: `${primaryColor}0d`, color: "#444" }}>
                              <span className="inline-flex items-start gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primaryColor }} aria-hidden />
                                <span className="line-clamp-4">{gift.humorTag}</span>
                              </span>
                            </div>
                          ) : null}
                          <p className="text-xs text-gray-500 mt-2">Valor livre (mín. R$ 50,00)</p>
                        </div>
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                          <Button
                            className="w-full text-white rounded-full"
                            style={{ backgroundColor: primaryColor }}
                            onClick={() => setHoneymoonGift(gift)}
                          >
                            Contribuir
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={gift.id} className="flex flex-col rounded-lg overflow-hidden shadow-sm border border-gray-100 bg-white hover:shadow-md transition">
                      {gift.imageUrl && (
                        <img src={resolveMediaUrl(gift.imageUrl)} alt={gift.name} className="w-full h-32 sm:h-36 object-cover" />
                      )}
                      <div className="p-2.5 sm:p-3 flex-1 flex flex-col min-h-0">
                        {gift.category && (
                          <span className="text-[10px] sm:text-xs uppercase tracking-wide font-medium mb-0.5 line-clamp-1" style={{ color: primaryColor }}>{gift.category}</span>
                        )}
                        <h3 className="text-sm sm:text-base leading-snug mb-0.5 line-clamp-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>{gift.name}</h3>
                        {gift.description && <p className="text-xs text-gray-500 line-clamp-2 flex-1">{gift.description}</p>}
                        {gift.humorTag ? (
                          <div className="mt-1.5 rounded-md border px-2 py-1 text-[11px] sm:text-xs italic leading-snug" style={{ borderColor: `${primaryColor}44`, backgroundColor: `${primaryColor}0d`, color: "#444" }}>
                            <span className="inline-flex items-start gap-1.5">
                              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 mt-0.5" style={{ color: primaryColor }} aria-hidden />
                              <span className="line-clamp-3">{gift.humorTag}</span>
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between gap-1.5">
                          <span className="text-sm font-bold tabular-nums shrink min-w-0 truncate" style={{ color: primaryColor }}>{price > 0 ? fmtBrl(price) : "Valor livre"}</span>
                          <Button
                            size="sm"
                            className="text-white rounded-full text-[10px] sm:text-xs h-8 px-2.5 shrink-0"
                            style={{ backgroundColor: primaryColor }}
                            onClick={() => handleAddNormal(gift)}
                          >
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 pt-4 sm:pt-5">
                  <p className="text-sm text-gray-500">
                    {rangeStart}–{rangeEnd} de {filtered.length} presente{filtered.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600 tabular-nums px-2">
                      {safePage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Próxima página"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {honeymoonGift && (
        <HoneymoonFundModal
          gift={honeymoonGift}
          primaryColor={primaryColor}
          onAdd={(customPrice) => {
            onAddItem({
              giftId: honeymoonGift.id,
              name: honeymoonGift.name,
              unitPrice: customPrice,
              quantity: 1,
              isHoneymoonFund: true,
              customPrice,
            });
            toast({ title: `Cota de R$ ${customPrice.toFixed(2)} adicionada ao carrinho` });
            setHoneymoonGift(null);
          }}
          onClose={() => setHoneymoonGift(null)}
        />
      )}
    </>
  );
}
