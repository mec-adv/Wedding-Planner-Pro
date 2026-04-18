import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CartItem } from "@/lib/shop-api";

interface CartDrawerProps {
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
  primaryColor: string;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
}

function fmtBrl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CartDrawer({
  items,
  totalAmount,
  totalItems,
  primaryColor,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: CartDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm bg-white transition hover:shadow-md"
          style={{ borderColor: primaryColor, color: primaryColor }}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm font-semibold hidden sm:inline">Carrinho</span>
          {totalItems > 0 && (
            <Badge
              className="absolute -top-2 -right-2 text-white text-xs w-5 h-5 flex items-center justify-center p-0 rounded-full"
              style={{ backgroundColor: primaryColor }}
            >
              {totalItems}
            </Badge>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
            Seu Carrinho
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <ShoppingCart className="w-10 h-10 opacity-30" />
              <p className="text-sm">Seu carrinho está vazio</p>
            </div>
          ) : (
            items.map((item, index) => {
              const price = item.isHoneymoonFund ? (item.customPrice ?? item.unitPrice) : item.unitPrice;
              return (
                <div key={index} className="flex gap-3 p-3 rounded-lg border border-gray-100 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtBrl(price)} × {item.quantity}</p>
                    <p className="text-sm font-semibold mt-1" style={{ color: primaryColor }}>
                      {fmtBrl(price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!item.isHoneymoonFund && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-50 text-gray-600"
                          onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm w-5 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-50 text-gray-600"
                          onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-600 transition"
                      onClick={() => onRemoveItem(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t space-y-3 bg-white">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-lg font-bold" style={{ color: primaryColor }}>{fmtBrl(totalAmount)}</span>
            </div>
            <Button
              className="w-full text-white rounded-full"
              style={{ backgroundColor: primaryColor }}
              onClick={onCheckout}
            >
              Finalizar Compra
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
