import { useState, useEffect } from "react";
import { useUpdateGuest, getListGuestsQueryKey } from "@workspace/api-client-react";
import type { Guest, GuestGroup, Wedding } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneInput } from "@/components/phone-input";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { stripPhoneDigits } from "@/lib/phone-br";
import { GroupComboBox } from "./GroupComboBox";

interface GuestEditDialogProps {
  weddingId: number;
  wedding: Wedding | undefined;
  guest: Guest | null;
  guestGroups: GuestGroup[] | undefined;
  onClose: () => void;
}

export function GuestEditDialog({
  weddingId,
  wedding,
  guest,
  guestGroups,
  onClose,
}: GuestEditDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [invitedBy, setInvitedBy] = useState<"" | "groom" | "bride">("");
  const [groupFilter, setGroupFilter] = useState("");
  const [groupComboOpen, setGroupComboOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateGuest();

  useEffect(() => {
    if (!guest) return;
    setName(guest.name);
    setEmail(guest.email ?? "");
    setPhoneDigits(stripPhoneDigits(guest.phone ?? ""));
    setGroupId(guest.guestGroupId ?? null);
    setInvitedBy(guest.invitedBy === "groom" || guest.invitedBy === "bride" ? guest.invitedBy : "");
    setGroupFilter("");
    setGroupComboOpen(false);
  }, [guest]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guest) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ variant: "destructive", title: "Informe o nome do convidado." });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        weddingId,
        id: guest.id,
        data: {
          name: trimmedName,
          email: email.trim() || null,
          phone: phoneDigits.trim() || null,
          guestGroupId: groupId,
          invitedBy: invitedBy === "groom" || invitedBy === "bride" ? invitedBy : null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(weddingId) });
      onClose();
      toast({ title: "Convidado atualizado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar convidado" });
    }
  };

  return (
    <Dialog open={guest != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Editar Convidado</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome Completo</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">WhatsApp</label>
              <PhoneInput
                className="mt-1.5"
                placeholder="(11) 99999-9999"
                value={phoneDigits}
                onDigitsChange={setPhoneDigits}
              />
            </div>
          </div>

          <GroupComboBox
            weddingId={weddingId}
            groups={guestGroups}
            selectedId={groupId}
            onSelect={setGroupId}
            filter={groupFilter}
            onFilterChange={setGroupFilter}
            open={groupComboOpen}
            onOpenChange={setGroupComboOpen}
          />

          <div>
            <label className="text-sm font-medium">Convidado por</label>
            <select
              value={invitedBy}
              onChange={(e) =>
                setInvitedBy(e.target.value === "groom" || e.target.value === "bride" ? e.target.value : "")
              }
              disabled={!wedding}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{wedding ? "Não informado" : "Carregando casamento…"}</option>
              {wedding && (
                <>
                  <option value="groom">{wedding.groomName}</option>
                  <option value="bride">{wedding.brideName}</option>
                </>
              )}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Use para acompanhar quantos convidados cada um trouxe.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
