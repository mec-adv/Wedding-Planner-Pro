import { useListWeddings, useCreateWedding, useGetMe, useDeleteWedding, ApiError } from "@workspace/api-client-react";
import type { Wedding } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus, Calendar, MapPin, Church, Scale, PencilLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatCeremony(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export default function SelectWedding() {
  const [, setLocation] = useLocation();
  const { data: weddings, isLoading } = useListWeddings();
  const { data: user } = useGetMe();
  const createMutation = useCreateWedding();
  const deleteWeddingMutation = useDeleteWedding();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [weddingPendingDelete, setWeddingPendingDelete] = useState<Wedding | null>(null);

  const canEditWedding = user?.role === "admin" || user?.role === "planner";
  const canDeleteWedding = (w: Wedding) =>
    Boolean(user && (user.role === "admin" || Number(w.createdById) === user.id));

  const confirmDeleteWedding = async () => {
    if (!weddingPendingDelete) return;
    try {
      await deleteWeddingMutation.mutateAsync({ id: weddingPendingDelete.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/weddings"] });
      setWeddingPendingDelete(null);
      toast({ title: "Casamento removido" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível apagar",
        description:
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const civilRaw = formData.get("civilCeremonyAt") as string;
    const religiousRaw = formData.get("religiousCeremonyAt") as string;
    if (!civilRaw || !religiousRaw) {
      toast({ variant: "destructive", title: "Informe as duas cerimônias", description: "Civil e religiosa são obrigatórias." });
      return;
    }
    try {
      const wedding = await createMutation.mutateAsync({
        data: {
          title: (formData.get("title") as string) || undefined,
          groomName: formData.get("groomName") as string,
          brideName: formData.get("brideName") as string,
          civilCeremonyAt: new Date(civilRaw).toISOString(),
          religiousCeremonyAt: new Date(religiousRaw).toISOString(),
          venue: (formData.get("venue") as string) || null,
          description: (formData.get("description") as string) || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/weddings"] });
      setIsOpen(false);
      setLocation(`/weddings/${wedding.id}/dashboard`);
      toast({ title: "Casamento criado" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível criar o casamento",
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-secondary/20 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-serif text-foreground mb-2">Olá, {user?.name}</h1>
            <p className="text-muted-foreground">
              Cadastre um casamento (civil e religioso) ou escolha um na lista. Use o menu lateral para trocar de casamento a qualquer momento.
            </p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all">
                <Plus className="w-5 h-5 mr-2" /> Novo casamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl font-serif">Novo casamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Título do evento (opcional)</label>
                  <Input name="title" placeholder="Ex.: Casamento Ana & Bruno" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome do noivo / parceiro 1</label>
                    <Input name="groomName" required placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome da noiva / parceiro 2</label>
                    <Input name="brideName" required placeholder="Nome completo" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5" /> Cerimônia civil
                    </label>
                    <Input name="civilCeremonyAt" type="datetime-local" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                      <Church className="w-3.5 h-3.5" /> Cerimônia religiosa
                    </label>
                    <Input name="religiousCeremonyAt" type="datetime-local" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Local principal (opcional)</label>
                  <Input name="venue" placeholder="Ex.: Igreja Nossa Senhora… / Cartório…" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Observações (opcional)</label>
                  <Textarea name="description" rows={2} placeholder="Notas internas sobre o evento" className="resize-none" />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando…" : "Criar casamento"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {weddings?.length === 0 ? (
          <Card className="p-12 text-center border-dashed bg-transparent shadow-none">
            <img
              src={`${import.meta.env.BASE_URL}images/empty-state.png`}
              alt=""
              className="w-48 h-48 mx-auto mb-6 opacity-80 mix-blend-multiply"
            />
            <h3 className="text-xl font-serif text-foreground mb-2">Nenhum casamento ainda</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Cadastre o primeiro evento com as datas da cerimônia civil e religiosa. Depois você poderá alternar entre vários casamentos pelo menu lateral.
            </p>
            <Button onClick={() => setIsOpen(true)}>Criar meu primeiro casamento</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weddings?.map((wedding) => (
              <Card
                key={wedding.id}
                className="h-full border-transparent hover:border-primary/20 overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="h-28 bg-primary/10 relative">
                  <Link
                    href={`/weddings/${wedding.id}/dashboard`}
                    className="absolute inset-0 z-0"
                    aria-label={`Abrir dashboard de ${wedding.title}`}
                  />
                  <Heart className="absolute right-4 bottom-4 w-12 h-12 text-primary/20 pointer-events-none z-[1]" />
                  {(canEditWedding || canDeleteWedding(wedding)) && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1.5">
                      {canEditWedding && (
                        <Button variant="secondary" size="icon" className="h-8 w-8 shadow-sm" asChild>
                          <Link href={`/weddings/${wedding.id}/edit`} title="Editar dados do casamento">
                            <PencilLine className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                      {canDeleteWedding(wedding) && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 shadow-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Excluir casamento"
                          onClick={() => setWeddingPendingDelete(wedding)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <Link href={`/weddings/${wedding.id}/dashboard`} className="block cursor-pointer">
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">{wedding.title}</CardTitle>
                    <CardDescription className="flex items-start gap-2 mt-2">
                      <Scale className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Civil: {formatCeremony(wedding.civilCeremonyAt ?? wedding.date)}</span>
                    </CardDescription>
                    <CardDescription className="flex items-start gap-2">
                      <Church className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Religiosa: {formatCeremony(wedding.religiousCeremonyAt ?? wedding.date)}</span>
                    </CardDescription>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      Referência (contagem): {format(new Date(wedding.date), "dd/MM/yyyy", { locale: ptBR })}
                    </CardDescription>
                    {wedding.venue && (
                      <CardDescription className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {wedding.venue}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={weddingPendingDelete != null} onOpenChange={(open) => !open && setWeddingPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este casamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O evento{" "}
              <span className="font-medium text-foreground">&quot;{weddingPendingDelete?.title}&quot;</span> será
              excluído com todos os dados vinculados (convidados, orçamento, etc.). Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWeddingMutation.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteWeddingMutation.isPending}
              onClick={() => void confirmDeleteWedding()}
            >
              {deleteWeddingMutation.isPending ? "Apagando…" : "Apagar definitivamente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
