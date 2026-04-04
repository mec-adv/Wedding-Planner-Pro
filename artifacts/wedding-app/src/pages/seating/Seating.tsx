import { useState, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useListTables, useCreateTable, useDeleteTable, useUpdateTable, useListSeatAssignments, useAssignSeat, useRemoveSeatAssignment, useListGuests } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Armchair, GripVertical, Users, LayoutGrid, List } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "map" | "list";

export default function Seating() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const [assignDialogTableId, setAssignDialogTableId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tables, isLoading } = useListTables(wid);
  const { data: assignments } = useListSeatAssignments(wid);
  const { data: guests } = useListGuests(wid);
  const createTableMutation = useCreateTable();
  const deleteTableMutation = useDeleteTable();
  const updateTableMutation = useUpdateTable();
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
    const existingCount = tables?.length || 0;
    const col = existingCount % 4;
    const row = Math.floor(existingCount / 4);
    try {
      await createTableMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          capacity: Number(fd.get("capacity") || 8),
          shape: (fd.get("shape") as "round" | "rectangular" | "square") || "round",
          positionX: 50 + col * 200,
          positionY: 50 + row * 200,
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

  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: number, posX: number, posY: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    setDraggingId(tableId);
    setDragOffset({
      x: e.clientX - rect.left - posX,
      y: e.clientY - rect.top - posY,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingId === null || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(rect.width - 150, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(0, Math.min(rect.height - 150, e.clientY - rect.top - dragOffset.y));

    const el = document.getElementById(`table-${draggingId}`);
    if (el) {
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    }
  }, [draggingId, dragOffset]);

  const handleMouseUp = useCallback(async () => {
    if (draggingId === null) return;
    const el = document.getElementById(`table-${draggingId}`);
    if (el) {
      const newX = parseInt(el.style.left);
      const newY = parseInt(el.style.top);
      try {
        await updateTableMutation.mutateAsync({
          weddingId: wid,
          id: draggingId,
          data: { positionX: newX, positionY: newY },
        });
        queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/tables`] });
      } catch {
        toast({ variant: "destructive", title: "Erro ao mover mesa" });
      }
    }
    setDraggingId(null);
  }, [draggingId, wid, updateTableMutation, queryClient, toast]);

  const getTableShape = (shape: string, isFull: boolean) => {
    const base = isFull ? "bg-primary/20 border-primary/40" : "bg-card border-border";
    switch (shape) {
      case "rectangular": return `${base} rounded-lg`;
      case "square": return `${base} rounded-md`;
      default: return `${base} rounded-full`;
    }
  };

  const getTableSize = (shape: string) => {
    switch (shape) {
      case "rectangular": return { width: 180, height: 120 };
      case "square": return { width: 140, height: 140 };
      default: return { width: 140, height: 140 };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Mapa de Assentos</h1>
          <p className="text-muted-foreground mt-1">Arraste as mesas para organizar o layout do salão.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <Button variant={viewMode === "map" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("map")} className="rounded-md">
              <LayoutGrid className="w-4 h-4 mr-1" /> Mapa
            </Button>
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="rounded-md">
              <List className="w-4 h-4 mr-1" /> Lista
            </Button>
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
      </div>

      {getUnassignedGuests().length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {getUnassignedGuests().length} convidado(s) confirmado(s) sem mesa atribuída
            </p>
          </CardContent>
        </Card>
      )}

      {viewMode === "map" ? (
        <div
          ref={mapRef}
          className="relative bg-muted/30 border-2 border-dashed border-border rounded-xl overflow-hidden select-none"
          style={{ height: "600px", cursor: draggingId ? "grabbing" : "default" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Carregando mesas...</div>
          ) : tables?.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Armchair className="w-12 h-12 opacity-30" />
              <p>Nenhuma mesa criada. Clique em &quot;Nova Mesa&quot; para começar.</p>
            </div>
          ) : tables?.map(table => {
            const tableAssignments = getTableAssignments(table.id);
            const capacity = table.capacity || 8;
            const isFull = tableAssignments.length >= capacity;
            const size = getTableSize(table.shape || "round");
            const posX = table.positionX ?? 50;
            const posY = table.positionY ?? 50;

            return (
              <div
                key={table.id}
                id={`table-${table.id}`}
                className={`absolute border-2 shadow-lg transition-shadow hover:shadow-xl flex flex-col items-center justify-center p-2 ${getTableShape(table.shape || "round", isFull)}`}
                style={{
                  left: posX,
                  top: posY,
                  width: size.width,
                  height: size.height,
                  cursor: draggingId === table.id ? "grabbing" : "grab",
                  zIndex: draggingId === table.id ? 50 : 10,
                }}
              >
                <div
                  className="absolute -top-1 -left-1 p-1 cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => handleMouseDown(e, table.id, posX, posY)}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="font-semibold text-xs text-foreground truncate max-w-full">{table.name}</span>
                <Badge variant={isFull ? "destructive" : "success"} className="text-[10px] mt-0.5">
                  {tableAssignments.length}/{capacity}
                </Badge>
                <div className="mt-1 text-[9px] text-muted-foreground max-h-8 overflow-hidden text-center leading-tight">
                  {tableAssignments.slice(0, 3).map(a => (
                    <div key={a.id} className="truncate">{a.guestName || `#${a.guestId}`}</div>
                  ))}
                  {tableAssignments.length > 3 && <div>+{tableAssignments.length - 3} mais</div>}
                </div>
                <div className="absolute -bottom-3 flex gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-1 shadow hover:scale-110 transition-transform"
                        onClick={() => setAssignDialogTableId(table.id)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Alocar Convidado - {table.name}</DialogTitle></DialogHeader>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {getUnassignedGuests().length === 0 ? (
                          <p className="text-sm text-muted-foreground p-4 text-center">Todos os convidados confirmados já estão alocados.</p>
                        ) : getUnassignedGuests().map(guest => (
                          <button key={guest.id} onClick={() => handleAssign(guest.id)}
                            className="w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors text-sm">
                            {guest.name} <span className="text-muted-foreground">({guest.guestGroupName ?? "sem grupo"})</span>
                          </button>
                        ))}
                      </div>
                      {tableAssignments.length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Sentados nesta mesa:</p>
                          {tableAssignments.map(a => (
                            <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 mb-1">
                              <span className="text-sm">{a.guestName || `#${a.guestId}`}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveAssignment(a.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <button
                    className="bg-destructive text-destructive-foreground rounded-full p-1 shadow hover:scale-110 transition-transform"
                    onClick={() => handleDeleteTable(table.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Arraste as mesas para posicionar
          </div>
        </div>
      ) : (
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
                <div className="flex justify-between items-start p-4 pb-2">
                  <div className="flex items-center gap-2">
                    <Armchair className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-lg">{table.name}</span>
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
                              {guest.name} <span className="text-muted-foreground">({guest.guestGroupName ?? "sem grupo"})</span>
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
      )}
    </div>
  );
}
