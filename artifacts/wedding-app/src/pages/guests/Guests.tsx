import { useState } from "react";
import { useParams } from "wouter";
import { useListGuests, useCreateGuest, useUpdateGuestRsvp, useDeleteGuest, useSendGuestInvite } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Mail, MessageCircle, Trash2, CheckCircle2, XCircle, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const RSVP_COLORS: Record<string, "warning" | "success" | "destructive" | "info"> = {
  pending: "warning",
  confirmed: "success",
  declined: "destructive",
  maybe: "info"
};

const RSVP_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Declinou",
  maybe: "Talvez"
};

export default function Guests() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: guests, isLoading } = useListGuests(wid, { search: search || undefined });
  const createMutation = useCreateGuest();
  const updateRsvpMutation = useUpdateGuestRsvp();
  const deleteMutation = useDeleteGuest();
  const sendInviteMutation = useSendGuestInvite();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          email: fd.get("email") as string || null,
          phone: fd.get("phone") as string || null,
          group: fd.get("group") as string || null,
          rsvpStatus: "pending",
          plusOne: fd.get("plusOne") === "on",
        }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
      setIsOpen(false);
      toast({ title: "Convidado adicionado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao adicionar" });
    }
  };

  const handleRsvp = async (id: number, status: "confirmed" | "declined" | "pending") => {
    try {
      await updateRsvpMutation.mutateAsync({
        weddingId: wid,
        id,
        data: { rsvpStatus: status }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar RSVP" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este convidado?")) return;
    try {
      await deleteMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const handleSendInvite = async (guestId: number, channel: "email" | "whatsapp") => {
    try {
      const result = await sendInviteMutation.mutateAsync({
        weddingId: wid,
        id: guestId,
        data: { channel },
      });
      const r = result as { success: boolean; message: string };
      if (r.success) {
        toast({ title: r.message });
        queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
      } else {
        toast({ variant: "destructive", title: r.message });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao enviar convite" });
    }
  };

  const confirmed = guests?.filter(g => g.rsvpStatus === "confirmed").length || 0;
  const pending = guests?.filter(g => g.rsvpStatus === "pending").length || 0;
  const total = guests?.length || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Lista de Convidados</h1>
          <p className="text-muted-foreground mt-1">Gerencie convites e confirmações de presença.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Adicionar Convidado</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Novo Convidado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
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
                  <Input name="phone" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Grupo (ex: Família Noiva)</label>
                <Input name="group" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="plusOne" name="plusOne" className="rounded text-primary focus:ring-primary" />
                <label htmlFor="plusOne" className="text-sm font-medium">Permitir Acompanhante (+1)</label>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Convidado"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{confirmed}</p>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou grupo..." 
              className="pl-9 bg-secondary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
              <tr>
                <th className="px-6 py-4 font-semibold">Nome</th>
                <th className="px-6 py-4 font-semibold">Contato</th>
                <th className="px-6 py-4 font-semibold">Grupo</th>
                <th className="px-6 py-4 font-semibold">Status RSVP</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              ) : guests?.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum convidado encontrado.</td></tr>
              ) : guests?.map((guest) => (
                <tr key={guest.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {guest.name} {guest.plusOne && <Badge variant="outline" className="ml-2 text-[10px]">+1</Badge>}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      {guest.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {guest.email}</span>}
                      {guest.phone && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3"/> {guest.phone}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{guest.group || '-'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={RSVP_COLORS[guest.rsvpStatus]}>{RSVP_LABELS[guest.rsvpStatus]}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {guest.email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendInvite(guest.id, "email")}
                          title="Enviar convite por email"
                          disabled={sendInviteMutation.isPending}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      {guest.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendInvite(guest.id, "whatsapp")}
                          title="Enviar convite por WhatsApp"
                          disabled={sendInviteMutation.isPending}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleRsvp(guest.id, 'confirmed')} title="Confirmar" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRsvp(guest.id, 'declined')} title="Declinar" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(guest.id)} title="Remover" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
