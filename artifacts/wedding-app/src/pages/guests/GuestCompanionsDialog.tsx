import { useState, useEffect } from "react";
import { useUpdateGuestRsvp, getListGuestsQueryKey } from "@workspace/api-client-react";
import type { Guest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneInput } from "@/components/phone-input";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { stripPhoneDigits } from "@/lib/phone-br";

type CompanionRow = { name: string; age: string; phoneDigits: string };

interface GuestCompanionsDialogProps {
  weddingId: number;
  guest: Guest | null;
  onClose: () => void;
}

export function GuestCompanionsDialog({ weddingId, guest, onClose }: GuestCompanionsDialogProps) {
  const [rows, setRows] = useState<CompanionRow[]>([]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateRsvpMutation = useUpdateGuestRsvp();

  useEffect(() => {
    if (!guest) return;
    setRows(
      (guest.companions ?? []).map((c) => ({
        name: c.name,
        age: String(c.age),
        phoneDigits: stripPhoneDigits(c.phone ?? ""),
      })),
    );
  }, [guest]);

  const updateRow = (index: number, patch: Partial<CompanionRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    if (!guest) return;
    const companions = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        age: Number.parseInt(r.age, 10),
        phone: r.phoneDigits.trim() || null,
      }));
    for (const c of companions) {
      if (!Number.isFinite(c.age) || c.age < 0 || c.age > 120) {
        toast({
          variant: "destructive",
          title: "Informe idades válidas (0–120) para todos os acompanhantes.",
        });
        return;
      }
    }
    try {
      await updateRsvpMutation.mutateAsync({
        weddingId,
        id: guest.id,
        data: { rsvpStatus: guest.rsvpStatus, companions },
      });
      await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(weddingId) });
      onClose();
      toast({ title: "Acompanhantes salvos" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar acompanhantes" });
    }
  };

  return (
    <Dialog open={guest != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Acompanhantes — {guest?.name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Nome e idade obrigatórios. Celular opcional. Ao salvar, a lista abaixo substitui a anterior.
        </p>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end border-b border-border/50 pb-3"
            >
              <div className="sm:col-span-5">
                <label className="text-xs font-medium">Nome</label>
                <Input value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium">Idade</label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={row.age}
                  onChange={(e) => updateRow(i, { age: e.target.value })}
                />
              </div>
              <div className="sm:col-span-4">
                <label className="text-xs font-medium">Celular (opcional)</label>
                <PhoneInput
                  value={row.phoneDigits}
                  onDigitsChange={(d) => updateRow(i, { phoneDigits: d })}
                />
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  title="Remover linha"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { name: "", age: "", phoneDigits: "" }])}
          >
            Adicionar acompanhante
          </Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={updateRsvpMutation.isPending}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
