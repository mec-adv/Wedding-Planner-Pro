import { useState } from "react";
import { useParams } from "wouter";
import { useListBudgetCategories, useGetBudgetSummary, useCreateBudgetCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, TrendingUp, TrendingDown } from "lucide-react";

const COLORS = ['#D4A373', '#E9C46A', '#F4A261', '#E76F51', '#2A9D8F', '#264653'];

export default function Budget() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetBudgetSummary(wid);
  const { data: categories, isLoading: loadingCats } = useListBudgetCategories(wid);
  const createMutation = useCreateBudgetCategory();

  const handleCreateCat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          estimatedTotal: Number(fd.get("estimatedTotal"))
        }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/budget`] });
      setIsOpen(false);
      toast({ title: "Categoria criada" });
    } catch {
      toast({ variant: "destructive", title: "Erro" });
    }
  };

  const chartData = summary?.byCategory.map(c => ({
    name: c.categoryName,
    value: c.actual > 0 ? c.actual : c.estimated
  })) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Orçamento</h1>
          <p className="text-muted-foreground mt-1">Controle financeiro detalhado do casamento.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Criar Categoria de Orçamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCat} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome (Ex: Fotografia, Buffet)</label>
                <Input name="name" required />
              </div>
              <div>
                <label className="text-sm font-medium">Valor Estimado (R$)</label>
                <Input name="estimatedTotal" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Estimado</p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {loadingSummary ? "..." : formatCurrency(summary?.totalEstimated || 0)}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Real Gasto</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {loadingSummary ? "..." : formatCurrency(summary?.totalActual || 0)}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Pago</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loadingSummary ? "..." : formatCurrency(summary?.totalPaid || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Falta Pagar</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {loadingSummary ? "..." : formatCurrency(summary?.totalRemaining || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados suficientes</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorias e Despesas</CardTitle>
        </CardHeader>
        <div className="p-6 pt-0">
          {loadingCats ? <p className="text-muted-foreground">Carregando...</p> : 
           summary?.byCategory.length === 0 ? <p className="text-muted-foreground">Nenhuma categoria criada.</p> :
           <div className="space-y-6">
             {summary?.byCategory.map((cat, i) => {
               const percentage = cat.estimated > 0 ? Math.min(100, (cat.actual / cat.estimated) * 100) : 0;
               const isOverBudget = cat.actual > cat.estimated;
               return (
                 <div key={cat.categoryId} className="space-y-2">
                   <div className="flex justify-between items-center">
                     <h3 className="font-semibold text-foreground flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                       {cat.categoryName}
                     </h3>
                     <div className="text-right text-sm">
                       <span className={isOverBudget ? "text-destructive font-bold" : "text-foreground font-medium"}>
                         {formatCurrency(cat.actual)}
                       </span>
                       <span className="text-muted-foreground"> / {formatCurrency(cat.estimated)}</span>
                     </div>
                   </div>
                   <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                     <div 
                       className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-destructive' : 'bg-primary'}`} 
                       style={{ width: `${percentage}%` }}
                     />
                   </div>
                 </div>
               )
             })}
           </div>
          }
        </div>
      </Card>
    </div>
  );
}
