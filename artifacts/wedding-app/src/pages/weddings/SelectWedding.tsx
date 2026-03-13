import { useListWeddings, useCreateWedding, useGetMe } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus, Calendar, MapPin } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useQueryClient } from "@tanstack/react-query";

export default function SelectWedding() {
  const [, setLocation] = useLocation();
  const { data: weddings, isLoading } = useListWeddings();
  const { data: user } = useGetMe();
  const createMutation = useCreateWedding();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const wedding = await createMutation.mutateAsync({
        data: {
          title: formData.get("title") as string,
          groomName: formData.get("groomName") as string,
          brideName: formData.get("brideName") as string,
          date: new Date(formData.get("date") as string).toISOString(),
          venue: formData.get("venue") as string,
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/weddings"] });
      setIsOpen(false);
      setLocation(`/weddings/${wedding.id}/dashboard`);
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-secondary/20 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-serif text-foreground mb-2">Olá, {user?.name}</h1>
            <p className="text-muted-foreground">Selecione um casamento para gerenciar ou crie um novo.</p>
          </div>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all">
                <Plus className="w-5 h-5 mr-2" /> Novo Casamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl font-serif">Criar Novo Casamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Título do Evento</label>
                  <Input name="title" required placeholder="Ex: Casamento João & Maria" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome do Noivo(a)</label>
                    <Input name="groomName" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome da Noiva(o)</label>
                    <Input name="brideName" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Data</label>
                    <Input name="date" type="datetime-local" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Local</label>
                    <Input name="venue" />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Casamento"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {weddings?.length === 0 ? (
          <Card className="p-12 text-center border-dashed bg-transparent shadow-none">
            <img 
              src={`${import.meta.env.BASE_URL}images/empty-state.png`} 
              alt="No weddings" 
              className="w-48 h-48 mx-auto mb-6 opacity-80 mix-blend-multiply"
            />
            <h3 className="text-xl font-serif text-foreground mb-2">Nenhum casamento encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">Você ainda não tem nenhum casamento cadastrado. Comece criando o seu primeiro evento.</p>
            <Button onClick={() => setIsOpen(true)}>Criar meu primeiro casamento</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weddings?.map(wedding => (
              <Link key={wedding.id} href={`/weddings/${wedding.id}/dashboard`}>
                <Card className="h-full cursor-pointer hover:-translate-y-1 transition-transform duration-300 border-transparent hover:border-primary/20 overflow-hidden group">
                  <div className="h-32 bg-primary/10 relative">
                    <Heart className="absolute right-4 bottom-4 w-12 h-12 text-primary/20" />
                  </div>
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">{wedding.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(wedding.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </CardDescription>
                    {wedding.venue && (
                      <CardDescription className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {wedding.venue}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
