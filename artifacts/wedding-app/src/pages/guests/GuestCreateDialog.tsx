import { useState } from "react";
import { useCreateGuest, getListGuestGroupsQueryKey, getListGuestsQueryKey } from "@workspace/api-client-react";
import type { GuestGroup, Wedding } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PhoneInput } from "@/components/phone-input";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { GroupComboBox } from "./GroupComboBox";

interface GuestCreateDialogProps {
  weddingId: number;
  wedding: Wedding | undefined;
  guestGroups: GuestGroup[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuestCreateDialog({
  weddingId,
  wedding,
  guestGroups,
  open,
  onOpenChange,
}: GuestCreateDialogProps) {
  const [phoneDigits, setPhoneDigits] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [groupComboOpen, setGroupComboOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateGuest();

  const reset = () => {
    setPhoneDigits("");
    setGroupId(null);
    setGroupFilter("");
    setGroupComboOpen(false);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const invitedRaw = (fd.get("invitedBy") as string) || "";
    const invitedBy = invitedRaw === "groom" || invitedRaw === "bride" ? invitedRaw : null;

    try {
      await createMutation.mutateAsync({
        weddingId,
        data: {
          name: fd.get("name") as string,
          email: (fd.get("email") as string) || null,
          phone: phoneDigits.trim() || null,
          guestGroupId: groupId,
          invitedBy,
          rsvpStatus: "pending",
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(weddingId) });
      onOpenChange(false);
      reset();
      toast({ title: "Convidado adicionado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao adicionar" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-full shadow-md">
          <Plus className="w-4 h-4 mr-2" /> Adicionar Convidado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Novo Convidado</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome Completo</label>
            <Input name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <Input name="email" type="email" />
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
              name="invitedBy"
              defaultValue=""
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

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Salvando..." : "Salvar Convidado"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
