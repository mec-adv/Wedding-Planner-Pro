import { useState } from "react";
import { useParams } from "wouter";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Clock, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const COLUMNS = [
  { id: "pending", title: "A Fazer" },
  { id: "in_progress", title: "Em Andamento" },
  { id: "completed", title: "Concluído" }
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 border-blue-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

export default function Tasks() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useListTasks(wid);
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          title: fd.get("title") as string,
          description: fd.get("description") as string,
          priority: fd.get("priority") as any,
          dueDate: fd.get("dueDate") as string || null,
          assignee: fd.get("assignee") as string || null,
          status: "pending",
          progress: 0
        }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/tasks`] });
      setIsOpen(false);
      toast({ title: "Tarefa adicionada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao adicionar" });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    try {
      // Optimistic update could go here
      await updateMutation.mutateAsync({
        weddingId: wid,
        id: Number(draggableId),
        data: { status: destination.droppableId as any }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/tasks`] });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao mover tarefa" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir tarefa?")) return;
    await deleteMutation.mutateAsync({ weddingId: wid, id });
    queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/tasks`] });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando quadro...</div>;

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">Organize o que precisa ser feito.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Nova Tarefa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Adicionar Tarefa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input name="title" required placeholder="Ex: Degustação do Buffet" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <select name="priority" className="flex h-11 w-full rounded-xl border-2 border-border/60 bg-background px-4 py-2 text-sm">
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Data Limite</label>
                  <Input name="dueDate" type="date" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Input name="assignee" placeholder="Ex: Cerimonialista, Noiva..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Tarefa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
          {COLUMNS.map(col => {
            const colTasks = tasks?.filter(t => t.status === col.id) || [];
            
            return (
              <div key={col.id} className="bg-secondary/30 rounded-2xl p-4 flex flex-col h-full border border-border/50">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="font-semibold text-foreground">{col.title}</h3>
                  <span className="bg-background text-muted-foreground text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm">
                    {colTasks.length}
                  </span>
                </div>
                
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto space-y-3 p-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                          {(provided, snap) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`shadow-sm border border-border/80 ${snap.isDragging ? 'shadow-lg ring-2 ring-primary/20 scale-105' : ''}`}
                            >
                              <div className="p-4 relative group">
                                <div className="flex items-start justify-between mb-2 gap-2">
                                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                                    {task.priority === 'high' || task.priority === 'urgent' ? <AlertTriangle className="w-3 h-3 inline mr-1" /> : null}
                                    {task.priority}
                                  </span>
                                  <button onClick={() => handleDelete(task.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                
                                <p className="font-medium text-foreground text-sm leading-tight mb-3">{task.title}</p>
                                
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  {task.dueDate ? (
                                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                                      <Clock className="w-3 h-3" />
                                      {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                    </div>
                                  ) : <div></div>}
                                  
                                  {task.assignee && (
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]" title={task.assignee}>
                                      {task.assignee.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
