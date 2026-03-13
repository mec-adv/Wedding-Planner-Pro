import { useState } from "react";
import { useParams } from "wouter";
import { useListScheduleItems, useCreateScheduleItem, useDeleteScheduleItem } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, User, Trash2, Clock } from "lucide-react";

export default function Schedule() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading } = useListScheduleItems(wid);
  const createMutation = useCreateScheduleItem();
  const deleteMutation = useDeleteScheduleItem();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          title: fd.get("title") as string,
          startTime: fd.get("startTime") as string,
          location: fd.get("location") as string || null,
          responsible: fd.get("responsible") as string || null,
          sortOrder: schedule ? schedule.length : 0
        }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/schedule`] });
      setIsOpen(false);
      toast({ title: "Evento adicionado" });
    } catch {
      toast({ variant: "destructive", title: "Erro" });
    }
  };

  const handleDelete = async (id: number) => {
    if(!confirm("Remover evento?")) return;
    await deleteMutation.mutateAsync({ weddingId: wid, id });
    queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/schedule`] });
  }

  // Sort by start time for visual representation
  const sortedSchedule = [...(schedule || [])].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Cronograma do Dia</h1>
          <p className="text-muted-foreground mt-1">O passo a passo do grande dia.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Novo Evento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Adicionar Evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Horário (HH:MM)</label>
                <Input name="startTime" type="time" required />
              </div>
              <div>
                <label className="text-sm font-medium">O que vai acontecer?</label>
                <Input name="title" required placeholder="Ex: Chegada da Noiva" />
              </div>
              <div>
                <label className="text-sm font-medium">Local</label>
                <Input name="location" placeholder="Ex: Entrada da Igreja" />
              </div>
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Input name="responsible" placeholder="Ex: Cerimonialista Mônica" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                Adicionar ao Cronograma
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative pl-8 sm:pl-32 py-6">
        {/* Timeline line */}
        <div className="absolute left-[39px] sm:left-[119px] top-0 bottom-0 w-0.5 bg-primary/20" />
        
        {isLoading ? <p className="text-muted-foreground text-center py-12">Carregando cronograma...</p> :
         sortedSchedule.length === 0 ? <p className="text-muted-foreground text-center py-12">Nenhum evento programado ainda.</p> :
         sortedSchedule.map((item) => (
          <div key={item.id} className="relative mb-8 group">
            {/* Timeline dot */}
            <div className="absolute -left-10 sm:-left-[88px] top-4 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-sm z-10 group-hover:scale-125 transition-transform" />
            
            {/* Time (left side on desktop, inside on mobile) */}
            <div className="hidden sm:block absolute -left-32 top-3 w-20 text-right">
              <span className="font-serif font-bold text-primary text-xl tracking-tight">{item.startTime}</span>
            </div>

            <Card className="hover:shadow-md transition-shadow border-border/60 hover:border-primary/30">
              <div className="p-5 flex justify-between items-start gap-4">
                <div>
                  <div className="sm:hidden mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-md text-sm font-bold">
                    <Clock className="w-4 h-4" /> {item.startTime}
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground">{item.title}</h3>
                  
                  <div className="mt-3 space-y-1.5">
                    {item.location && (
                      <p className="text-sm flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary/60" /> {item.location}
                      </p>
                    )}
                    {item.responsible && (
                      <p className="text-sm flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4 text-primary/60" /> {item.responsible}
                      </p>
                    )}
                  </div>
                </div>
                
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
