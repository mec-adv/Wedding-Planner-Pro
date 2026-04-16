import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneBrReadOnly } from "@/lib/phone-br";
import { copyTextToClipboard } from "@/lib/clipboard";

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

interface GuestGroup {
  id: number;
  name: string;
}

interface GuestTableProps {
  weddingId: number;
  guests: Guest[] | undefined;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  rsvpFilter: string;
  onRsvpFilterChange: (value: string) => void;
  invitedByFilter: string;
  onInvitedByFilterChange: (value: string) => void;
  groupIdFilter: string;
  onGroupIdFilterChange: (value: string) => void;
  groups: GuestGroup[];
  groomName: string | undefined;
  brideName: string | undefined;
  onEdit: (guest: Guest) => void;
  onOpenCompanions: (guest: Guest) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function GuestTable({
  weddingId,
  guests,
  isLoading,
  search,
  onSearchChange,
  rsvpFilter,
  onRsvpFilterChange,
  invitedByFilter,
  onInvitedByFilterChange,
  groupIdFilter,
  onGroupIdFilterChange,
  groups,
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, rsvpFilter, invitedByFilter, groupIdFilter, pageSize]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(weddingId) });

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
      await copyTextToClipboard(buildPublicInviteUrl(guest));
      toast({ title: "Link da página pública copiado" });
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível copiar",
        description: "Copie manualmente o link na barra de endereço ao abrir a pré-visualização.",
      });
    }
  };

  const guestInvitedByLabel = (invitedBy: string | null | undefined) => {
    if (invitedBy === "groom" && groomName) return groomName;
    if (invitedBy === "bride" && brideName) return brideName;
    return "—";
  };

  // Client-side filters for invitedBy and groupId (RSVP status is filtered server-side)
  const filtered = (guests ?? []).filter((g) => {
    if (invitedByFilter === "groom" && g.invitedBy !== "groom") return false;
    if (invitedByFilter === "bride" && g.invitedBy !== "bride") return false;
    if (invitedByFilter === "none" && g.invitedBy != null) return false;
    if (groupIdFilter && String(g.guestGroupId ?? "") !== groupIdFilter) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const rangeStart = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(clampedPage * pageSize, total);

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/50">
        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou grupo..."
              className="pl-9 bg-secondary/20"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <Select value={rsvpFilter || "all"} onValueChange={(v) => onRsvpFilterChange(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue placeholder="Status RSVP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="declined">Declinou</SelectItem>
              <SelectItem value="maybe">Talvez</SelectItem>
            </SelectContent>
          </Select>

          <Select value={invitedByFilter || "all"} onValueChange={(v) => onInvitedByFilterChange(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40 shrink-0">
              <SelectValue placeholder="Convidado por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {groomName && <SelectItem value="groom">{groomName}</SelectItem>}
              {brideName && <SelectItem value="bride">{brideName}</SelectItem>}
              <SelectItem value="none">Não definido</SelectItem>
            </SelectContent>
          </Select>

          {groups.length > 0 && (
            <Select value={groupIdFilter || "all"} onValueChange={(v) => onGroupIdFilterChange(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 shrink-0">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum convidado encontrado.
                </td>
              </tr>
            ) : (
              paginated.map((guest) => (
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

      {/* Pagination footer */}
      {!isLoading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-border/50 text-sm text-muted-foreground">
          <span>
            Mostrando {rangeStart}–{rangeEnd} de {total} convidado{total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">Por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={clampedPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs">
                {clampedPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={clampedPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
