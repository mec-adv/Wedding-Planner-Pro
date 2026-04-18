import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart } from "lucide-react";
import type { ShopGift } from "@/lib/shop-api";

interface Props {
  gift: ShopGift;
  primaryColor: string;
  onAdd: (customPrice: number) => void;
  onClose: () => void;
}

export function HoneymoonFundModal({ gift, primaryColor, onAdd, onClose }: Props) {
  const [amount, setAmount] = useState("100");
  const [error, setError] = useState("");

  function handleAdd() {
    const val = parseFloat(amount);
    if (!Number.isFinite(val) || val < 50) {
      setError("O valor mínimo para a Cota de Lua de Mel é R$ 50,00.");
      return;
    }
    onAdd(val);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm bg-[#FDFCF8] border-gray-200 text-[#333]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
            {gift.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Heart className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
            <span>Contribua com o valor que desejar (mínimo R$ 50,00)</span>
          </div>
          {gift.description && <p className="text-sm text-gray-500">{gift.description}</p>}
          <div>
            <label className="text-sm font-semibold">Valor da contribuição (R$)</label>
            <Input
              type="number"
              min={50}
              step="10"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
              className="mt-1"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 text-white" style={{ backgroundColor: primaryColor }} onClick={handleAdd}>
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
