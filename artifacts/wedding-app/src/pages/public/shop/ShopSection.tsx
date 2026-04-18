import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Heart, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/api-url";
import {
  fetchShopGifts, fetchShopCategories, fetchShopSettings, postMuralMessage,
} from "@/lib/shop-api";
import type { ShopGift, CartItem } from "@/lib/shop-api";
import type { PublicInvitePageConfig } from "../public-invite-page-config";
import { HoneymoonFundModal } from "./HoneymoonFundModal";
import { useToast } from "@/hooks/use-toast";

type SortOption = "default" | "asc" | "desc" | "name";

interface ShopSectionProps {
  cfg: PublicInvitePageConfig;
  primaryColor: string;
  weddingId: number;
  guestToken: string;
  guestName: string;
  onAddItem: (item: CartItem) => void;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ShopSection({
  cfg,
  primaryColor,
  weddingId,
  guestToken,
  guestName,
  onAddItem,
}: ShopSectionProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>("default");
  const [honeymoonGift, setHoneymoonGift] = useState<ShopGift | null>(null);

  // Mural form
  const [muralAuthor, setMuralAuthor] = useState(guestName);
  const [muralText, setMuralText] = useState("");
  const [muralSending, setMuralSending] = useState(false);
  const [muralSent, setMuralSent] = useState(false);

  useEffect(() => { setMuralAuthor(guestName); }, [guestName]);

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

  const filtered = useMemo(() => {
    let list = gifts.filter((g) => {
      if (activeCategory !== null && g.category !== categories.find((c) => c.id === activeCategory)?.name) return false;
      if (search.trim()) return g.name.toLowerCase().includes(search.toLowerCase()) || (g.description ?? "").toLowerCase().includes(search.toLowerCase());
      return true;
    });

    if (sort === "asc") list = [...list].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sort === "desc") list = [...list].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return list;
  }, [gifts, search, activeCategory, sort, categories]);

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

  async function handleSendMural() {
    if (!muralAuthor.trim()) { toast({ variant: "destructive", title: "Informe seu nome" }); return; }
    if (!muralText.trim()) { toast({ variant: "destructive", title: "Escreva uma mensagem" }); return; }
    if (muralText.length > 500) { toast({ variant: "destructive", title: "Mensagem muito longa (máx. 500 caracteres)" }); return; }
    setMuralSending(true);
    try {
      await postMuralMessage({ guestToken, authorName: muralAuthor.trim(), message: muralText.trim() });
      setMuralText("");
      setMuralSent(true);
      toast({ title: "Mensagem enviada com carinho!" });
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Erro ao enviar mensagem" });
    } finally {
      setMuralSending(false);
    }
  }

  const progressPct = shopSettings?.showProgressBar && shopSettings.progressGoal
    ? Math.min(100, Math.round(((shopSettings.totalRaised ?? 0) / shopSettings.progressGoal) * 100))
    : 0;

  const inputClass = "w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 bg-white text-[#333] placeholder:text-gray-400 focus:ring-[color:var(--invite-primary)] focus:border-[color:var(--invite-primary)]";

  return (
    <>
      <section className="py-20 px-6 border-t border-gray-200" id="presentes">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
              {cfg.giftsSectionTitle}
            </h2>
            <p className="text-lg">{cfg.giftsTagline}</p>
          </div>

          {/* Progress bar */}
          {shopSettings?.showProgressBar && shopSettings.progressGoal && (
            <div className="mb-10 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Arrecadado</span>
                <span className="font-semibold" style={{ color: primaryColor }}>
                  {fmtBrl(shopSettings.totalRaised ?? 0)} / {fmtBrl(shopSettings.progressGoal)}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${primaryColor}22` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: primaryColor }} />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">{progressPct}%</p>
            </div>
          )}

          {/* Filters */}
          {!giftsLoading && gifts.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar presente…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
              >
                <option value="default">Padrão</option>
                <option value="asc">Menor preço</option>
                <option value="desc">Maior preço</option>
                <option value="name">A–Z</option>
              </select>
            </div>
          )}

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition"
                style={activeCategory === null ? { backgroundColor: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#ccc", color: "#555" }}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition"
                  style={activeCategory === cat.id ? { backgroundColor: primaryColor, color: "#fff", borderColor: primaryColor } : { borderColor: "#ccc", color: "#555" }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Gift grid */}
          {giftsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 italic py-12">{cfg.giftsEmptyMessage}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((gift) => {
                const price = parseFloat(gift.price);
                if (gift.isHoneymoonFund) {
                  return (
                    <div
                      key={gift.id}
                      className="relative flex flex-col rounded-xl overflow-hidden shadow-sm border-2 bg-white"
                      style={{ borderColor: primaryColor }}
                    >
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="w-5 h-5" style={{ color: primaryColor }} />
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: primaryColor }}>Cota de Lua de Mel</span>
                        </div>
                        <h3 className="text-xl mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>{gift.name}</h3>
                        {gift.description && <p className="text-sm text-gray-500 line-clamp-3 flex-1">{gift.description}</p>}
                        <p className="text-sm text-gray-500 mt-2">Valor livre (mín. R$ 50,00)</p>
                      </div>
                      <div className="px-5 pb-5">
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
                  <div key={gift.id} className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-white hover:shadow-md transition">
                    {gift.imageUrl && (
                      <img src={resolveMediaUrl(gift.imageUrl)} alt={gift.name} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      {gift.category && (
                        <span className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: primaryColor }}>{gift.category}</span>
                      )}
                      <h3 className="text-lg mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>{gift.name}</h3>
                      {gift.description && <p className="text-sm text-gray-500 line-clamp-2 flex-1">{gift.description}</p>}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-base font-bold" style={{ color: primaryColor }}>{price > 0 ? fmtBrl(price) : "Valor livre"}</span>
                        <Button
                          size="sm"
                          className="text-white rounded-full text-xs"
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
          )}
        </div>
      </section>

      {/* Mural section */}
      <section className="py-16 px-6 border-t border-gray-200 bg-white" id="mural">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
            Mural de Mensagens
          </h2>
          <p className="text-gray-500 mb-8">Deixe uma mensagem especial para os noivos.</p>

          {muralSent ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
              <Heart className="w-10 h-10 mx-auto mb-3" style={{ color: primaryColor }} />
              <p className="font-semibold text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>Mensagem enviada!</p>
              <button type="button" className="mt-4 text-sm underline text-gray-500" onClick={() => setMuralSent(false)}>Enviar outra</button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4 text-left">
              <div>
                <label className="text-sm font-semibold">Seu nome</label>
                <Input
                  className={inputClass}
                  value={muralAuthor}
                  onChange={(e) => setMuralAuthor(e.target.value)}
                  style={{ ["--invite-primary" as string]: primaryColor }}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Mensagem</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-none`}
                  value={muralText}
                  onChange={(e) => setMuralText(e.target.value)}
                  maxLength={500}
                  placeholder="Compartilhe um desejo, uma lembrança…"
                  style={{ ["--invite-primary" as string]: primaryColor }}
                />
                <p className="text-xs text-gray-400 text-right">{muralText.length}/500</p>
              </div>
              <Button
                className="w-full text-white rounded-full gap-2"
                style={{ backgroundColor: primaryColor }}
                disabled={muralSending}
                onClick={() => void handleSendMural()}
              >
                <Send className="w-4 h-4" />
                {muralSending ? "Enviando…" : "Enviar mensagem"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Honeymoon fund modal */}
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
