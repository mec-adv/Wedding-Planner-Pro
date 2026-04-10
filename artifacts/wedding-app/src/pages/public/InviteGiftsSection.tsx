import type { Gift as GiftDto } from "@workspace/api-client-react";
import type { PublicInvitePageConfig } from "./public-invite-page-config";

interface InviteGiftsSectionProps {
  cfg: PublicInvitePageConfig;
  primaryColor: string;
  gifts: GiftDto[] | undefined;
  giftsLoading: boolean;
  onSelectGift: (gift: { id: number; name: string; price: number }) => void;
}

export function InviteGiftsSection({
  cfg,
  primaryColor,
  gifts,
  giftsLoading,
  onSelectGift,
}: InviteGiftsSectionProps) {
  return (
    <section className="py-20 px-6 text-center border-t border-gray-200">
      <div className="max-w-2xl mx-auto p-10 bg-white rounded-lg shadow-sm border border-gray-100">
        <h2
          className="text-4xl mb-4"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
        >
          {cfg.giftsSectionTitle}
        </h2>
        <p className="text-lg mb-6">{cfg.giftsTagline}</p>

        {giftsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 text-left">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : gifts?.length === 0 ? (
          <p className="text-gray-500 italic">{cfg.giftsEmptyMessage}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 text-left mt-8">
            {gifts?.map((gift: GiftDto) => {
              const value = Number(gift.price) || 0;
              return (
                <button
                  key={gift.id}
                  type="button"
                  className="text-left p-6 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition bg-[#FDFCF8] w-full"
                  onClick={() => onSelectGift({ id: gift.id, name: gift.name, price: value })}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span
                      className="text-xl"
                      style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
                    >
                      {gift.name}
                    </span>
                    <span
                      className="text-xs uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${primaryColor}22`, color: primaryColor }}
                    >
                      Disponível
                    </span>
                  </div>
                  {gift.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">{gift.description}</p>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-lg font-semibold" style={{ color: primaryColor }}>
                      {value > 0 ? `R$ ${value.toFixed(2)}` : "Valor livre"}
                    </span>
                    <span className="text-sm font-semibold underline" style={{ color: primaryColor }}>
                      Presentear
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
