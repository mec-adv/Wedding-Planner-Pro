import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useGetPublicInvite, getGetPublicInviteQueryKey } from "@workspace/api-client-react";
import { ShopSection } from "./shop/ShopSection";
import { CartDrawer } from "./shop/CartDrawer";
import { ShopCheckoutDialog } from "./shop/ShopCheckoutDialog";
import { useCart } from "./shop/use-cart";
import { resolvePublicInvitePageConfig } from "./public-invite-page-config";

const oliva = "#708238";
const creme = "#FDFCF8";
/** Mesmo tom do rodapé da página de convite (`PublicInvite`). */
const grafite = "#333333";

const DEFAULT_PATTERN_STYLE: CSSProperties = {
  backgroundImage: `radial-gradient(${oliva} 0.5px, transparent 0.5px)`,
  backgroundSize: "20px 20px",
  backgroundColor: creme,
};

export default function PublicInviteShop() {
  const { token } = useParams<{ token: string }>();
  const t = token ?? "";
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: invite, isLoading, isError, error } = useGetPublicInvite(t, {
    query: { enabled: !!t && t.length >= 32, queryKey: getGetPublicInviteQueryKey(t) },
  });

  const w = invite?.wedding;
  const cfg = useMemo(
    () => (invite ? resolvePublicInvitePageConfig(invite.template?.config) : null),
    [invite],
  );

  const primary = cfg?.primaryColor ?? oliva;
  const bg = cfg?.backgroundColor ?? creme;
  const weddingId = w?.id ?? 0;
  const bride = w?.brideName ?? "";
  const groom = w?.groomName ?? "";

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    return () => {
      document.documentElement.classList.remove("scroll-smooth");
    };
  }, []);

  useEffect(() => {
    if (bride || groom) {
      document.title = `Lista de presentes — ${[bride, groom].filter(Boolean).join(" & ")}`;
    } else {
      document.title = "Lista de presentes";
    }
  }, [bride, groom]);

  if (!t || t.length < 32) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ color: grafite, backgroundColor: creme }}>
        <p className="opacity-80">Link inválido.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ ...DEFAULT_PATTERN_STYLE, color: grafite }}>
        <div className="animate-pulse text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
          Carregando loja…
        </div>
      </div>
    );
  }
  if (isError || !invite || !cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ ...DEFAULT_PATTERN_STYLE, color: grafite }}>
        <p className="opacity-80">{error instanceof Error ? error.message : "Não encontramos este convite."}</p>
      </div>
    );
  }

  const rootStyle: CSSProperties = {
    backgroundImage: `radial-gradient(${cfg.patternDotColor} 0.5px, transparent 0.5px)`,
    backgroundSize: "20px 20px",
    backgroundColor: bg,
    color: cfg.textColor,
    fontFamily: "'Lato', sans-serif",
    ["--invite-primary" as string]: primary,
  };

  return (
    <div className="min-h-screen antialiased text-[15px]" style={rootStyle}>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <Link href={`/p/convite/${t}`}>
          <button
            type="button"
            className="flex items-center gap-2 text-sm mb-2 hover:opacity-80 transition"
            style={{ color: primary }}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao convite
          </button>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href={`/p/convite/${t}/pedidos`}>
            <span className="underline cursor-pointer opacity-90 hover:opacity-100" style={{ color: primary }}>
              Ver meus pedidos
            </span>
          </Link>
        </div>
      </div>

      {weddingId > 0 ? (
        <>
          <ShopSection cfg={cfg} primaryColor={primary} weddingId={weddingId} onAddItem={cart.addItem} />
          <div className="fixed top-4 right-4 z-50">
            <CartDrawer
              items={cart.items}
              totalAmount={cart.totalAmount}
              totalItems={cart.totalItems}
              primaryColor={primary}
              onUpdateQuantity={cart.updateQuantity}
              onRemoveItem={cart.removeItem}
              onCheckout={() => setCheckoutOpen(true)}
            />
          </div>
          <ShopCheckoutDialog
            open={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            items={cart.items}
            totalAmount={cart.totalAmount}
            weddingId={weddingId}
            guestToken={t}
            guestName={invite.guest?.name ?? ""}
            guestPhone={invite.guest?.phone ?? null}
            primaryColor={primary}
            onSuccess={() => {
              cart.reset();
              setCheckoutOpen(false);
            }}
          />
        </>
      ) : (
        <div className="text-center py-20 px-6 opacity-80">Casamento não encontrado.</div>
      )}

      <footer className="text-white text-center py-8 mt-8" style={{ backgroundColor: grafite }}>
        <p className="text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {bride}
          {bride && groom ? " & " : ""}
          {groom}
        </p>
        <p className="text-sm opacity-70">{cfg.footerLine2}</p>
      </footer>
    </div>
  );
}
