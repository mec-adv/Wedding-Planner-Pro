import { useState } from "react";
import { useParams } from "wouter";
import { useListGifts, useCreateGift } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Gift, Plus, Image as ImageIcon, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Gifts() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gifts, isLoading } = useListGifts(wid);
  const createMutation = useCreateGift();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          category: fd.get("category") as string,
          price: Number(fd.get("price")),
          humorTag: fd.get("humorTag") as string || null,
          imageUrl: fd.get("imageUrl") as string || null,
          isActive: true,
        }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/gifts`] });
      setIsOpen(false);
      toast({ title: "Presente adicionado com sucesso" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao adicionar" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary/5 p-6 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/20 rounded-2xl">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif text-foreground">Lista de Presentes</h1>
            <p className="text-muted-foreground mt-1">Crie experiências divertidas para seus convidados.</p>
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Novo Presente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Adicionar Experiência/Presente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome do Presente</label>
                <Input name="name" required placeholder="Ex: Jantar nas Maldivas" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input name="price" type="number" step="0.01" required />
                </div>
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <select name="category" className="flex h-11 w-full rounded-xl border-2 border-border/60 bg-background px-4 py-2 text-sm">
                    <option value="viagem">Viagem</option>
                    <option value="casa">Casa Nova</option>
                    <option value="experiencia">Experiência</option>
                    <option value="humor">Zoeira</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Tag Engraçada (opcional)
                </label>
                <Input name="humorTag" placeholder="Ex: Para o noivo não reclamar da comida" />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> URL da Imagem (opcional)
                </label>
                <Input name="imageUrl" placeholder="https://..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Presente"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl"></div>)}
        </div>
      ) : gifts?.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground mb-4">Sua lista está vazia. Adicione cotas de lua de mel ou presentes divertidos!</p>
          <Button onClick={() => setIsOpen(true)} variant="outline">Começar a criar</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {gifts?.map((gift) => (
            <Card key={gift.id} className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group">
              <div className="aspect-video bg-secondary relative overflow-hidden">
                {gift.imageUrl ? (
                  <img src={gift.imageUrl} alt={gift.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/40">
                    <Gift className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur font-bold shadow-sm">
                    {formatCurrency(gift.price)}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="font-serif text-lg font-semibold text-foreground line-clamp-1">{gift.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">{gift.category}</p>
                
                {gift.humorTag && (
                  <div className="mt-3 p-2 bg-secondary/50 rounded-lg border border-primary/10">
                    <p className="text-sm italic text-foreground flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {gift.humorTag}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
