import { useState } from "react";
import { useParams } from "wouter";
import { useListCoordinators, useCreateCoordinator, useDeleteCoordinator } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Mail, Trash2, UserCog } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Coordinators() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: coordinators, isLoading } = useListCoordinators(wid);
  const createMutation = useCreateCoordinator();
  const deleteMutation = useDeleteCoordinator();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          role: fd.get("role") as string,
          phone: fd.get("phone") as string || null,
          email: fd.get("email") as string || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/coordinators`] });
      setIsOpen(false);
      toast({ title: "Coordenador adicionado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao adicionar" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este coordenador?")) return;
    try {
      await deleteMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/coordinators`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Equipe / Coordenadores</h1>
          <p className="text-muted-foreground mt-1">Gerencie a equipe de coordenação do casamento.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Novo Coordenador</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif text-xl">Adicionar Coordenador</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="text-sm font-medium">Nome</label><Input name="name" required /></div>
              <div><label className="text-sm font-medium">Função</label><Input name="role" placeholder="Ex: Cerimonialista, Assistente" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Telefone</label><Input name="phone" /></div>
                <div><label className="text-sm font-medium">E-mail</label><Input name="email" type="email" /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Coordenador"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>)
        ) : coordinators?.length === 0 ? (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhum coordenador cadastrado.</CardContent></Card>
        ) : coordinators?.map(coord => (
          <Card key={coord.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-primary/10">
                  <UserCog className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{coord.name}</h3>
                  <p className="text-sm text-muted-foreground">{coord.role}</p>
                  <div className="mt-3 space-y-1">
                    {coord.phone && <p className="text-sm flex items-center gap-2"><Phone className="w-3 h-3" /> {coord.phone}</p>}
                    {coord.email && <p className="text-sm flex items-center gap-2"><Mail className="w-3 h-3" /> {coord.email}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(coord.id)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
