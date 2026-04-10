import {
  useUpdateGuestRsvp,
  useDeleteGuest,
  useSendGuestInvite,
  useRotateGuestInviteToken,
  getListGuestsQueryKey,
} from "@workspace/api-client-react";
import type { Guest } from "@workspace/api-client-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Mail,
  MessageCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  Send,
  UserPlus,
  Pencil,
  Link2,
  KeyRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneBrReadOnly } from "@/lib/phone-br";

const RSVP_COLORS: Record<string, "warning" | "success" | "destructive" | "info"> = {
  pending: "warning",
  confirmed: "success",
  declined: "destructive",
  maybe: "info",
};

const RSVP_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Declinou",
  maybe: "Talvez",
};

function companionsSummary(g: Guest): string {
  const list = g.companions ?? [];
  if (list.length === 0) return "—";
  return list
    .map((c) => {
      const tel = c.phone ? ` · ${formatPhoneBrReadOnly(c.phone)}` : "";
      return `${c.name} (${c.age}a)${tel}`;
    })
    .join("; ");
}

function buildPublicInviteUrl(guest: Guest): string {
  const path = guest.publicInvitePath ?? `/p/convite/${guest.inviteToken}`;
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${window.location.origin}${base}${path.replace(/^\//, "")}`;
}

interface GuestTableProps {
  weddingId: number;
  guests: Guest[] | undefined;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  groomName: string | undefined;
  brideName: string | undefined;
  onEdit: (guest: Guest) => void;
  onOpenCompanions: (guest: Guest) => void;
}

export function GuestTable({
  weddingId,
  guests,
  isLoading,
  search,
  onSearchChange,
  groomName,
  brideName,
  onEdit,
  onOpenCompanions,
}: GuestTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateRsvpMutation = useUpdateGuestRsvp();
  const deleteMutation = useDeleteGuest();
  const sendInviteMutation = useSendGuestInvite();
  const rotateTokenMutation = useRotateGuestInviteToken();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(weddingId, { search: search || undefined }) });

  const handleRsvp = async (id: number, status: "confirmed" | "declined" | "pending") => {
    try {
      await updateRsvpMutation.mutateAsync({ weddingId, id, data: { rsvpStatus: status } });
      await invalidate();
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar RSVP" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ weddingId, id });
      await invalidate();
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const handleSendInvite = async (guestId: number, channel: "email" | "whatsapp") => {
    try {
      const result = await sendInviteMutation.mutateAsync({ weddingId, id: guestId, data: { channel } });
      const r = result as { success: boolean; message: string };
      if (r.success) {
        toast({ title: r.message });
        await invalidate();
      } else {
        toast({ variant: "destructive", title: r.message });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao enviar convite" });
    }
  };

  const handleRotateToken = async (guestId: number) => {
    try {
      await rotateTokenMutation.mutateAsync({ weddingId, id: guestId });
      await invalidate();
      toast({ title: "Novo link gerado" });
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro" });
    }
  };

  const copyLink = async (guest: Guest) => {
    try {
      await navigator.clipboard.writeText(buildPublicInviteUrl(guest));
      toast({ title: "Link da página pública copiado" });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  };

  const guestInvitedByLabel = (invitedBy: string | null | undefined) => {
    if (invitedBy === "groom" && groomName) return groomName;
    if (invitedBy === "bride" && brideName) return brideName;
    return "—";
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/50">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou grupo..."
            className="pl-9 bg-secondary/20"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
            <tr>
              <th className="px-6 py-4 font-semibold">Nome</th>
              <th className="px-6 py-4 font-semibold">Convidado por</th>
              <th className="px-6 py-4 font-semibold">Contato</th>
              <th className="px-6 py-4 font-semibold">Grupo</th>
              <th className="px-6 py-4 font-semibold min-w-[200px]">Acompanhantes</th>
              <th className="px-6 py-4 font-semibold">Status RSVP</th>
              <th className="px-6 py-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : guests?.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum convidado encontrado.
                </td>
              </tr>
            ) : (
              guests?.map((guest) => (
                <tr
                  key={guest.id}
                  className="border-b border-border/50 hover:bg-secondary/10 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-foreground">{guest.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {guestInvitedByLabel(guest.invitedBy)}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      {guest.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {guest.email}
                        </span>
                      )}
                      {guest.phone && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 shrink-0" />
                          {formatPhoneBrReadOnly(guest.phone)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{guest.guestGroupName ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground text-xs max-w-xs">
                    <span className="line-clamp-3" title={companionsSummary(guest)}>
                      {companionsSummary(guest)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={RSVP_COLORS[guest.rsvpStatus]}>{RSVP_LABELS[guest.rsvpStatus]}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => onEdit(guest)}
                        title="Editar dados"
                        className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => onOpenCompanions(guest)}
                        title="Acompanhantes"
                        className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => void copyLink(guest)}
                        title="Copiar link da página pública"
                        className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                      >
                        <Link2 className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost" size="icon"
                            title="Gerar novo link público"
                            disabled={rotateTokenMutation.isPending}
                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O link antigo deixará de funcionar.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleRotateToken(guest.id)}>
                              Gerar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {guest.email && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => void handleSendInvite(guest.id, "email")}
                          title="Enviar convite por email"
                          disabled={sendInviteMutation.isPending}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      {guest.phone && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => void handleSendInvite(guest.id, "whatsapp")}
                          title="Enviar convite por WhatsApp"
                          disabled={sendInviteMutation.isPending}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => void handleRsvp(guest.id, "confirmed")}
                        title="Confirmar"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => void handleRsvp(guest.id, "declined")}
                        title="Declinar"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost" size="icon"
                            title="Remover"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover convidado?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => void handleDelete(guest.id)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
