import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import {
  useListGuests,
  useCreateGuest,
  useUpdateGuest,
  useUpdateGuestRsvp,
  useDeleteGuest,
  useSendGuestInvite,
  useGetWedding,
  useListGuestGroups,
  useCreateGuestGroup,
  useImportGuests,
  getListGuestGroupsQueryKey,
  getListGuestsQueryKey,
  useRotateGuestInviteToken,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhoneInput } from "@/components/phone-input";
import {
  Search,
  Plus,
  Mail,
  MessageCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  Send,
  ChevronsUpDown,
  Check,
  UserPlus,
  Pencil,
  Upload,
  Download,
  FileDown,
  ChevronDown,
  Link2,
  KeyRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPhoneBrReadOnly, stripPhoneDigits } from "@/lib/phone-br";
import {
  buildGuestsExportCsv,
  downloadUtf8Csv,
  guestImportTemplateCsv,
  parseCsv,
  guestImportRowsToInputs,
} from "@/lib/guests-csv";
import type { Guest, GuestInput } from "@workspace/api-client-react";

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
  const [groupComboOpen, setGroupComboOpen] = useState(false);
  const [guestGroupId, setGuestGroupId] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const groupComboRef = useRef<HTMLDivElement>(null);
  const [newGuestPhoneDigits, setNewGuestPhoneDigits] = useState("");
  const [companionGuest, setCompanionGuest] = useState<Guest | null>(null);
  const [companionRows, setCompanionRows] = useState<
    { name: string; age: string; phoneDigits: string }[]
  >([]);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhoneDigits, setEditPhoneDigits] = useState("");
  const [editGuestGroupId, setEditGuestGroupId] = useState<number | null>(null);
  const [editInvitedBy, setEditInvitedBy] = useState<"" | "groom" | "bride">("");
  const [editGroupComboOpen, setEditGroupComboOpen] = useState(false);
  const [editGroupFilter, setEditGroupFilter] = useState("");
  const editGroupComboRef = useRef<HTMLDivElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importReadyGuests, setImportReadyGuests] = useState<GuestInput[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: guests, isLoading } = useListGuests(wid, { search: search || undefined });
  const { data: wedding } = useGetWedding(wid);
  const { data: guestGroups } = useListGuestGroups(wid, {
    query: {
      queryKey: getListGuestGroupsQueryKey(wid),
      enabled: (isOpen || editingGuest != null || importOpen) && Number.isFinite(wid),
    },
  });
  const createGuestGroupMutation = useCreateGuestGroup();
  const createMutation = useCreateGuest();
  const updateGuestMutation = useUpdateGuest();
  const updateRsvpMutation = useUpdateGuestRsvp();
  const deleteMutation = useDeleteGuest();
  const sendInviteMutation = useSendGuestInvite();
  const rotateInviteTokenMutation = useRotateGuestInviteToken();
  const importGuestsMutation = useImportGuests();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const invitedRaw = (fd.get("invitedBy") as string) || "";
      const invitedBy =
        invitedRaw === "groom" || invitedRaw === "bride" ? invitedRaw : null;
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          email: fd.get("email") as string || null,
          phone: newGuestPhoneDigits.trim() ? newGuestPhoneDigits.trim() : null,
          guestGroupId,
          invitedBy,
          rsvpStatus: "pending",
        }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
      setIsOpen(false);
      setGuestGroupId(null);
      setGroupFilter("");
      setNewGuestPhoneDigits("");
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

  const buildPublicInviteUrl = (guest: Guest) => {
    const path = guest.publicInvitePath ?? `/p/convite/${guest.inviteToken}`;
    const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    return `${window.location.origin}${base}${path.replace(/^\//, "")}`;
  };

  const copyPublicInviteLink = async (guest: Guest) => {
    try {
      await navigator.clipboard.writeText(buildPublicInviteUrl(guest));
      toast({ title: "Link da página pública copiado" });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  };

  const handleRotateInviteToken = async (guestId: number) => {
    if (!confirm("Gerar novo link? O link antigo deixará de funcionar.")) return;
    try {
      await rotateInviteTokenMutation.mutateAsync({ weddingId: wid, id: guestId });
      await queryClient.invalidateQueries({
        queryKey: getListGuestsQueryKey(wid, { search: search || undefined }),
      });
      toast({ title: "Novo link gerado" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro" });
    }
  };

  const confirmed = guests?.filter(g => g.rsvpStatus === "confirmed").length || 0;
  const pending = guests?.filter(g => g.rsvpStatus === "pending").length || 0;
  const total = guests?.length || 0;
  const countByGroom = guests?.filter((g) => g.invitedBy === "groom").length ?? 0;
  const countByBride = guests?.filter((g) => g.invitedBy === "bride").length ?? 0;
  const countInvitedUnset = guests?.filter((g) => g.invitedBy == null).length ?? 0;

  const guestInvitedByLabel = (invitedBy: string | null | undefined) => {
    if (invitedBy === "groom" && wedding) return wedding.groomName;
    if (invitedBy === "bride" && wedding) return wedding.brideName;
    return "—";
  };

  const selectedGroupLabel =
    guestGroupId != null ? guestGroups?.find((g) => g.id === guestGroupId)?.name : null;

  const selectedEditGroupLabel =
    editGuestGroupId != null ? guestGroups?.find((g) => g.id === editGuestGroupId)?.name : null;

  const trimmedFilter = groupFilter.trim();
  const hasExactGroup =
    trimmedFilter.length > 0 &&
    guestGroups?.some((g) => g.name.toLowerCase() === trimmedFilter.toLowerCase());
  const filteredGuestGroups =
    guestGroups?.filter((g) =>
      trimmedFilter ? g.name.toLowerCase().includes(trimmedFilter.toLowerCase()) : true,
    ) ?? [];

  const editTrimmedFilter = editGroupFilter.trim();
  const editHasExactGroup =
    editTrimmedFilter.length > 0 &&
    guestGroups?.some((g) => g.name.toLowerCase() === editTrimmedFilter.toLowerCase());
  const editFilteredGuestGroups =
    guestGroups?.filter((g) =>
      editTrimmedFilter ? g.name.toLowerCase().includes(editTrimmedFilter.toLowerCase()) : true,
    ) ?? [];

  useEffect(() => {
    if (!groupComboOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = groupComboRef.current;
      if (el && !el.contains(e.target as Node)) {
        setGroupComboOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [groupComboOpen]);

  useEffect(() => {
    if (!editGroupComboOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = editGroupComboRef.current;
      if (el && !el.contains(e.target as Node)) {
        setEditGroupComboOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editGroupComboOpen]);

  const resetEditDialog = () => {
    setEditingGuest(null);
    setEditName("");
    setEditEmail("");
    setEditPhoneDigits("");
    setEditGuestGroupId(null);
    setEditInvitedBy("");
    setEditGroupComboOpen(false);
    setEditGroupFilter("");
  };

  const openEditGuest = (g: Guest) => {
    setEditingGuest(g);
    setEditName(g.name);
    setEditEmail(g.email ?? "");
    setEditPhoneDigits(stripPhoneDigits(g.phone ?? ""));
    setEditGuestGroupId(g.guestGroupId ?? null);
    setEditInvitedBy(g.invitedBy === "groom" || g.invitedBy === "bride" ? g.invitedBy : "");
    setEditGroupComboOpen(false);
    setEditGroupFilter("");
  };

  const handleUpdateGuest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGuest) return;
    const name = editName.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Informe o nome do convidado." });
      return;
    }
    try {
      await updateGuestMutation.mutateAsync({
        weddingId: wid,
        id: editingGuest.id,
        data: {
          name,
          email: editEmail.trim() ? editEmail.trim() : null,
          phone: editPhoneDigits.trim() ? editPhoneDigits.trim() : null,
          guestGroupId: editGuestGroupId,
          invitedBy: editInvitedBy === "groom" || editInvitedBy === "bride" ? editInvitedBy : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
      resetEditDialog();
      toast({ title: "Convidado atualizado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar convidado" });
    }
  };

  const handleCreateEditGuestGroup = async () => {
    const name = editTrimmedFilter;
    if (!name || editHasExactGroup) return;
    try {
      const created = await createGuestGroupMutation.mutateAsync({
        weddingId: wid,
        data: { name },
      });
      queryClient.invalidateQueries({ queryKey: getListGuestGroupsQueryKey(wid) });
      setEditGuestGroupId(created.id);
      setEditGroupComboOpen(false);
      setEditGroupFilter("");
      toast({ title: "Grupo criado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao criar grupo" });
    }
  };

  const openCompanionsEditor = (g: Guest) => {
    setCompanionGuest(g);
    setCompanionRows(
      (g.companions ?? []).map((c) => ({
        name: c.name,
        age: String(c.age),
        phoneDigits: stripPhoneDigits(c.phone ?? ""),
      })),
    );
  };

  const saveCompanions = async () => {
    if (!companionGuest) return;
    const companions = companionRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        age: Number.parseInt(r.age, 10),
        phone: r.phoneDigits.trim() ? r.phoneDigits.trim() : null,
      }));
    for (const c of companions) {
      if (!Number.isFinite(c.age) || c.age < 0 || c.age > 120) {
        toast({ variant: "destructive", title: "Informe idades válidas (0–120) para todos os acompanhantes." });
        return;
      }
    }
    try {
      await updateRsvpMutation.mutateAsync({
        weddingId: wid,
        id: companionGuest.id,
        data: {
          rsvpStatus: companionGuest.rsvpStatus,
          companions,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
      setCompanionGuest(null);
      toast({ title: "Acompanhantes salvos" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar acompanhantes" });
    }
  };

  const companionsSummary = (g: Guest) => {
    const list = g.companions ?? [];
    if (list.length === 0) return "—";
    return list
      .map((c) => {
        const tel = c.phone ? ` · ${formatPhoneBrReadOnly(c.phone)}` : "";
        return `${c.name} (${c.age}a)${tel}`;
      })
      .join("; ");
  };

  const handleCreateGuestGroup = async () => {
    const name = trimmedFilter;
    if (!name || hasExactGroup) return;
    try {
      const created = await createGuestGroupMutation.mutateAsync({
        weddingId: wid,
        data: { name },
      });
      queryClient.invalidateQueries({ queryKey: getListGuestGroupsQueryKey(wid) });
      setGuestGroupId(created.id);
      setGroupComboOpen(false);
      setGroupFilter("");
      toast({ title: "Grupo criado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao criar grupo" });
    }
  };

  const resetImportState = () => {
    setImportFileContent(null);
    setImportReadyGuests([]);
    setImportWarnings([]);
    setImportParseError(null);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const handleExportCsv = () => {
    if (!guests?.length) {
      toast({ variant: "destructive", title: "Nenhum convidado para exportar." });
      return;
    }
    const body = buildGuestsExportCsv(guests, (s) => RSVP_LABELS[s] ?? s);
    const d = new Date().toISOString().slice(0, 10);
    downloadUtf8Csv(`convidados-${wid}-${d}.csv`, body);
    toast({ title: "Lista exportada" });
  };

  const handleDownloadImportTemplate = () => {
    downloadUtf8Csv("modelo-convidados.csv", guestImportTemplateCsv());
    toast({ title: "Modelo baixado" });
  };

  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportParseError(null);
    setImportFileContent(null);
    setImportReadyGuests([]);
    setImportWarnings([]);
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result ?? "");
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      setImportFileContent(text);
    };
    reader.onerror = () => {
      setImportParseError("Não foi possível ler o arquivo.");
    };
    reader.readAsText(file, "UTF-8");
  };

  useEffect(() => {
    if (!importOpen || importFileContent === null) return;
    const matrix = parseCsv(importFileContent);
    const { guests: g, warnings } = guestImportRowsToInputs(matrix, guestGroups);
    setImportWarnings(warnings);
    setImportReadyGuests(g);
    if (g.length === 0) {
      const primary =
        warnings.find((w) => w.includes("Cabeçalho")) ??
        warnings.find((w) => w.includes("Arquivo vazio")) ??
        warnings[0] ??
        "Nenhum convidado válido no arquivo.";
      setImportParseError(primary);
    } else {
      setImportParseError(null);
    }
  }, [importOpen, importFileContent, guestGroups]);

  const handleRunImport = async () => {
    if (importReadyGuests.length === 0) return;
    try {
      const result = await importGuestsMutation.mutateAsync({
        weddingId: wid,
        data: { guests: importReadyGuests },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
      const msg = `Importados: ${result.imported}. Erros: ${result.errors}.`;
      toast({
        title: "Importação concluída",
        description: result.messages.length ? result.messages.slice(0, 5).join(" · ") : msg,
      });
      if (importWarnings.length) {
        toast({
          title: "Avisos do arquivo",
          description: importWarnings.slice(0, 8).join(" · "),
        });
      }
      setImportOpen(false);
      resetImportState();
    } catch {
      toast({ variant: "destructive", title: "Erro ao importar convidados" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Lista de Convidados</h1>
          <p className="text-muted-foreground mt-1">Gerencie convites e confirmações de presença.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full shadow-sm">
                <Upload className="w-4 h-4 mr-2" />
                Importar / Exportar
                <ChevronDown className="w-4 h-4 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onSelect={() => {
                  setImportOpen(true);
                  resetImportState();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportCsv}>
                <Download className="w-4 h-4 mr-2" />
                Exportar lista (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDownloadImportTemplate}>
                <FileDown className="w-4 h-4 mr-2" />
                Baixar modelo CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
              setGuestGroupId(null);
              setGroupFilter("");
              setGroupComboOpen(false);
              setNewGuestPhoneDigits("");
            }
          }}
        >
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
                  <PhoneInput
                    className="mt-1.5"
                    placeholder="(11) 99999-9999"
                    value={newGuestPhoneDigits}
                    onDigitsChange={setNewGuestPhoneDigits}
                  />
                </div>
              </div>
              <div ref={groupComboRef} className="relative">
                <label className="text-sm font-medium">Grupo</label>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={groupComboOpen}
                  className="mt-1.5 w-full justify-between font-normal"
                  onClick={() => setGroupComboOpen((o) => !o)}
                >
                  {selectedGroupLabel ?? "Selecione ou crie um grupo…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {groupComboOpen && (
                  <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="border-b border-border px-2 py-2">
                      <Input
                        placeholder="Buscar ou digite um novo…"
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
                        autoFocus
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto p-1">
                      {filteredGuestGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setGuestGroupId(g.id);
                            setGroupComboOpen(false);
                            setGroupFilter("");
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              guestGroupId === g.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {g.name}
                        </button>
                      ))}
                      {trimmedFilter && !hasExactGroup && (
                        <button
                          type="button"
                          className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => void handleCreateGuestGroup()}
                          disabled={createGuestGroupMutation.isPending}
                        >
                          Criar grupo &quot;{trimmedFilter}&quot;
                        </button>
                      )}
                      {guestGroups == null && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          Carregando grupos…
                        </p>
                      )}
                      {guestGroups != null &&
                        filteredGuestGroups.length === 0 &&
                        !trimmedFilter && (
                          <p className="px-2 py-3 text-sm text-muted-foreground">
                            Nenhum grupo cadastrado.
                          </p>
                        )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Colegas, Trabalho e Família vêm por padrão; você pode adicionar outros.
                </p>
              </div>
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
        </div>

        <Dialog
          open={editingGuest != null}
          onOpenChange={(open) => {
            if (!open) resetEditDialog();
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Editar Convidado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateGuest} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome Completo</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">E-mail</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">WhatsApp</label>
                  <PhoneInput
                    className="mt-1.5"
                    placeholder="(11) 99999-9999"
                    value={editPhoneDigits}
                    onDigitsChange={setEditPhoneDigits}
                  />
                </div>
              </div>
              <div ref={editGroupComboRef} className="relative">
                <label className="text-sm font-medium">Grupo</label>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={editGroupComboOpen}
                  className="mt-1.5 w-full justify-between font-normal"
                  onClick={() => setEditGroupComboOpen((o) => !o)}
                >
                  {selectedEditGroupLabel ?? "Selecione ou crie um grupo…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {editGroupComboOpen && (
                  <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="border-b border-border px-2 py-2">
                      <Input
                        placeholder="Buscar ou digite um novo…"
                        value={editGroupFilter}
                        onChange={(e) => setEditGroupFilter(e.target.value)}
                        className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
                        autoFocus
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto p-1">
                      {editFilteredGuestGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setEditGuestGroupId(g.id);
                            setEditGroupComboOpen(false);
                            setEditGroupFilter("");
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              editGuestGroupId === g.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {g.name}
                        </button>
                      ))}
                      {editTrimmedFilter && !editHasExactGroup && (
                        <button
                          type="button"
                          className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => void handleCreateEditGuestGroup()}
                          disabled={createGuestGroupMutation.isPending}
                        >
                          Criar grupo &quot;{editTrimmedFilter}&quot;
                        </button>
                      )}
                      {guestGroups == null && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          Carregando grupos…
                        </p>
                      )}
                      {guestGroups != null &&
                        editFilteredGuestGroups.length === 0 &&
                        !editTrimmedFilter && (
                          <p className="px-2 py-3 text-sm text-muted-foreground">
                            Nenhum grupo cadastrado.
                          </p>
                        )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Colegas, Trabalho e Família vêm por padrão; você pode adicionar outros.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Convidado por</label>
                <select
                  value={editInvitedBy}
                  onChange={(e) =>
                    setEditInvitedBy(
                      e.target.value === "groom" || e.target.value === "bride"
                        ? e.target.value
                        : "",
                    )
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
              <Button type="submit" className="w-full" disabled={updateGuestMutation.isPending}>
                {updateGuestMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={companionGuest != null} onOpenChange={(o) => !o && setCompanionGuest(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                Acompanhantes — {companionGuest?.name}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Nome e idade obrigatórios. Celular opcional. Ao salvar, a lista abaixo substitui a anterior.
            </p>
            <div className="space-y-3">
              {companionRows.map((row, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end border-b border-border/50 pb-3">
                  <div className="sm:col-span-5">
                    <label className="text-xs font-medium">Nome</label>
                    <Input
                      value={row.name}
                      onChange={(e) => {
                        const next = [...companionRows];
                        next[i] = { ...next[i], name: e.target.value };
                        setCompanionRows(next);
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium">Idade</label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={row.age}
                      onChange={(e) => {
                        const next = [...companionRows];
                        next[i] = { ...next[i], age: e.target.value };
                        setCompanionRows(next);
                      }}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-xs font-medium">Celular (opcional)</label>
                    <PhoneInput
                      value={row.phoneDigits}
                      onDigitsChange={(d) => {
                        const next = [...companionRows];
                        next[i] = { ...next[i], phoneDigits: d };
                        setCompanionRows(next);
                      }}
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setCompanionRows(companionRows.filter((_, j) => j !== i))}
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
                onClick={() =>
                  setCompanionRows([...companionRows, { name: "", age: "", phoneDigits: "" }])
                }
              >
                Adicionar acompanhante
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCompanionGuest(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void saveCompanions()} disabled={updateRsvpMutation.isPending}>
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={importOpen}
          onOpenChange={(open) => {
            setImportOpen(open);
            if (!open) resetImportState();
          }}
        >
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Importar convidados (CSV)</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Uma linha por convidado titular. Colunas:{" "}
              <strong>nome</strong> (obrigatório), <strong>email</strong>, <strong>whatsapp</strong>,{" "}
              <strong>grupo</strong> (nome do grupo), <strong>convidado_por</strong> (noivo, noiva, groom ou
              bride), <strong>observacoes</strong>. Acompanhantes são cadastrados na confirmação.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo</label>
              <Input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFileSelected}
                className="cursor-pointer"
              />
            </div>
            {guestGroups == null && importFileContent !== null && (
              <p className="text-xs text-muted-foreground">Carregando grupos para validar nomes…</p>
            )}
            {importParseError && (
              <p className="text-sm text-destructive" role="alert">
                {importParseError}
              </p>
            )}
            {importWarnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-100 max-h-36 overflow-y-auto space-y-1">
                <p className="font-medium">Avisos</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {importWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {importReadyGuests.length > 0 && (
              <p className="text-sm text-foreground">
                <strong>{importReadyGuests.length}</strong> convidado(s) pronto(s) para importar.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleRunImport()}
                disabled={
                  importReadyGuests.length === 0 || importGuestsMutation.isPending || guestGroups == null
                }
              >
                {importGuestsMutation.isPending ? "Importando…" : "Importar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {total > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          {wedding && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{countByGroom}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2" title={wedding.groomName}>
                    Por {wedding.groomName}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{countByBride}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2" title={wedding.brideName}>
                    Por {wedding.brideName}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{countInvitedUnset}</p>
                  <p className="text-xs text-muted-foreground">Sem &quot;convidado por&quot;</p>
                </CardContent>
              </Card>
            </div>
          )}
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
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              ) : guests?.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum convidado encontrado.</td></tr>
              ) : guests?.map((guest) => (
                <tr key={guest.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{guest.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {guestInvitedByLabel(guest.invitedBy)}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      {guest.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {guest.email}</span>}
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
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditGuest(guest)}
                        title="Editar dados"
                        className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openCompanionsEditor(guest)}
                        title="Acompanhantes"
                        className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void copyPublicInviteLink(guest)}
                        title="Copiar link da página pública (RSVP e presentes)"
                        className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                      >
                        <Link2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleRotateInviteToken(guest.id)}
                        title="Gerar novo link público"
                        disabled={rotateInviteTokenMutation.isPending}
                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
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
