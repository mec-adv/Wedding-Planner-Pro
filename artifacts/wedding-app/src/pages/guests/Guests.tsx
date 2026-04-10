import { useState } from "react";
import { useParams } from "wouter";
import {
  useListGuests,
  useGetWedding,
  useListGuestGroups,
  getListGuestGroupsQueryKey,
} from "@workspace/api-client-react";
import type { Guest } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileDown, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildGuestsExportCsv, downloadUtf8Csv, guestImportTemplateCsv } from "@/lib/guests-csv";
import { GuestStats } from "./GuestStats";
import { GuestTable } from "./GuestTable";
import { GuestCreateDialog } from "./GuestCreateDialog";
import { GuestEditDialog } from "./GuestEditDialog";
import { GuestCompanionsDialog } from "./GuestCompanionsDialog";
import { GuestImportDialog } from "./GuestImportDialog";

export default function Guests() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [companionGuest, setCompanionGuest] = useState<Guest | null>(null);

  const { data: guests, isLoading } = useListGuests(wid, { search: search || undefined });
  const { data: wedding } = useGetWedding(wid);
  const { data: guestGroups } = useListGuestGroups(wid, {
    query: {
      queryKey: getListGuestGroupsQueryKey(wid),
      enabled: (createOpen || editingGuest != null || importOpen) && Number.isFinite(wid),
    },
  });

  if (!Number.isFinite(wid) || wid <= 0) return null;

  const handleExportCsv = () => {
    if (!guests?.length) {
      toast({ variant: "destructive", title: "Nenhum convidado para exportar." });
      return;
    }
    const LABELS: Record<string, string> = {
      pending: "Pendente",
      confirmed: "Confirmado",
      declined: "Declinou",
      maybe: "Talvez",
    };
    const body = buildGuestsExportCsv(guests, (s) => LABELS[s] ?? s);
    const d = new Date().toISOString().slice(0, 10);
    downloadUtf8Csv(`convidados-${wid}-${d}.csv`, body);
    toast({ title: "Lista exportada" });
  };

  const handleDownloadTemplate = () => {
    downloadUtf8Csv("modelo-convidados.csv", guestImportTemplateCsv());
    toast({ title: "Modelo baixado" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabeçalho */}
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
              <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Importar CSV…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportCsv}>
                <Download className="w-4 h-4 mr-2" /> Exportar lista (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDownloadTemplate}>
                <FileDown className="w-4 h-4 mr-2" /> Baixar modelo CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <GuestCreateDialog
            weddingId={wid}
            wedding={wedding}
            guestGroups={guestGroups}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
        </div>
      </div>

      {/* Estatísticas */}
      <GuestStats guests={guests} groomName={wedding?.groomName} brideName={wedding?.brideName} />

      {/* Tabela */}
      <GuestTable
        weddingId={wid}
        guests={guests}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        groomName={wedding?.groomName}
        brideName={wedding?.brideName}
        onEdit={setEditingGuest}
        onOpenCompanions={setCompanionGuest}
      />

      {/* Diálogos controlados pelo orquestrador */}
      <GuestEditDialog
        weddingId={wid}
        wedding={wedding}
        guest={editingGuest}
        guestGroups={guestGroups}
        onClose={() => setEditingGuest(null)}
      />
      <GuestCompanionsDialog
        weddingId={wid}
        guest={companionGuest}
        onClose={() => setCompanionGuest(null)}
      />
      <GuestImportDialog
        weddingId={wid}
        guestGroups={guestGroups}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
