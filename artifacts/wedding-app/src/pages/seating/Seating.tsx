import { useState } from "react";
import { useParams } from "wouter";
import { useListTables, useCreateTable, useDeleteTable, useListSeatAssignments, useAssignSeat, useRemoveSeatAssignment, useListGuests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Armchair } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Seating() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const [assignDialogTableId, setAssignDialogTableId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tables, isLoading } = useListTables(wid);
  const { data: assignments } = useListSeatAssignments(wid);
  const { data: guests } = useListGuests(wid);
  const createTableMutation = useCreateTable();
  const deleteTableMutation = useDeleteTable();
  const assignSeatMutation = useAssignSeat();
  const removeSeatMutation = useRemoveSeatAssignment();

  const getTableAssignments = (tableId: number) =>
    assignments?.filter(a => a.tableId === tableId) || [];

  const getUnassignedGuests = () => {
    const assignedIds = new Set(assignments?.map(a => a.guestId) || []);
    return guests?.filter(g => !assignedIds.has(g.id) && g.rsvpStatus === "confirmed") || [];
  };

  const handleCreateTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createTableMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          capacity: Number(fd.get("capacity") || 8),
          shape: (fd.get("shape") as any) || "round",
          positionX: 0,
          positionY: 0,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/tables`] });
      setIsOpen(false);
      toast({ title: "Mesa criada" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao criar mesa" });
    }
  };

  const handleDeleteTable = async (id: number) => {
    if (!confirm("Remover esta mesa?")) return;
    try {
      await deleteTableMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/tables`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const handleAssign = async (guestId: number) => {
    if (!assignDialogTableId) return;
    try {
      await assignSeatMutation.mutateAsync({
        weddingId: wid,
        data: { guestId, tableId: assignDialogTableId },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/seat-assignments`] });
      toast({ title: "Convidado alocado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao alocar" });
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    try {
      await removeSeatMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/seat-assignments`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Mapa de Assentos</h1>
          <p className="text-muted-foreground mt-1">Organize a distribuição dos convidados nas mesas.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Nova Mesa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif text-xl">Criar Mesa</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateTable} className="space-y-4">
              <div><label className="text-sm font-medium">Nome da Mesa</label><Input name="name" required placeholder="Mesa 1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Capacidade</label><Input name="capacity" type="number" defaultValue={8} /></div>
                <div>
                  <label className="text-sm font-medium">Formato</label>
                  <select name="shape" className="w-full p-2.5 border rounded-lg bg-background text-sm mt-1">
                    <option value="round">Redonda</option>
                    <option value="rectangular">Retangular</option>
                    <option value="square">Quadrada</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createTableMutation.isPending}>
                {createTableMutation.isPending ? "Criando..." : "Criar Mesa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {getUnassignedGuests().length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-800">
              {getUnassignedGuests().length} convidado(s) confirmado(s) sem mesa atribuída
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-48" /></Card>)
        ) : tables?.length === 0 ? (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhuma mesa criada.</CardContent></Card>
        ) : tables?.map(table => {
          const tableAssignments = getTableAssignments(table.id);
          const isFull = tableAssignments.length >= (table.capacity || 8);

          return (
            <Card key={table.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Armchair className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{table.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isFull ? "destructive" : "success"}>
                      {tableAssignments.length}/{table.capacity || 8}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTable(table.id)} className="text-destructive hover:bg-destructive/10 -mr-2">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {tableAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <span className="text-sm">{a.guestName || `Convidado #${a.guestId}`}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveAssignment(a.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {!isFull && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setAssignDialogTableId(table.id)}>
                        <Plus className="w-3 h-3 mr-1" /> Adicionar Convidado
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Alocar Convidado na {table.name}</DialogTitle></DialogHeader>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {getUnassignedGuests().length === 0 ? (
                          <p className="text-sm text-muted-foreground p-4 text-center">Todos os convidados confirmados já estão alocados.</p>
                        ) : getUnassignedGuests().map(guest => (
                          <button key={guest.id} onClick={() => handleAssign(guest.id)}
                            className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm">
                            {guest.name} <span className="text-muted-foreground">({guest.group || "sem grupo"})</span>
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
