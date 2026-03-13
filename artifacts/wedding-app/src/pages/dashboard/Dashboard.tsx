import { useGetDashboard } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Users, CheckSquare, Gift, DollarSign, CalendarHeart } from "lucide-react";
import { differenceInDays } from "date-fns";

export default function Dashboard() {
  const { weddingId } = useParams();
  const { data, isLoading, error } = useGetDashboard(Number(weddingId));

  if (isLoading) return <div className="animate-pulse flex space-y-4 flex-col"><div className="h-8 bg-muted rounded w-1/4"></div><div className="grid grid-cols-4 gap-4"><div className="h-32 bg-muted rounded"></div><div className="h-32 bg-muted rounded"></div></div></div>;
  if (error || !data) return <div className="text-destructive">Erro ao carregar dashboard</div>;

  const { wedding, totalGuests, confirmedGuests, completedTasks, totalTasks, totalBudgetEstimated, totalBudgetActual, totalGiftReceived } = data;
  const daysLeft = differenceInDays(new Date(wedding.date), new Date());

  const stats = [
    { label: "Convidados Confirmados", value: `${confirmedGuests} / ${totalGuests}`, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Tarefas Concluídas", value: `${completedTasks} / ${totalTasks}`, icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Orçamento Gasto", value: formatCurrency(totalBudgetActual), subtext: `de ${formatCurrency(totalBudgetEstimated)}`, icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Presentes Recebidos", value: formatCurrency(totalGiftReceived), icon: Gift, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-primary/10 to-secondary p-8 rounded-3xl border border-primary/10">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2">Resumo do Casamento</h1>
          <p className="text-muted-foreground text-lg">{wedding.title}</p>
        </div>
        <div className="text-center bg-card p-4 rounded-2xl shadow-sm border border-border/50 min-w-[160px]">
          <CalendarHeart className="w-8 h-8 text-primary mx-auto mb-2" />
          <div className="text-3xl font-serif font-bold text-foreground">{daysLeft > 0 ? daysLeft : 0}</div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mt-1">Dias Restantes</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-md hover:shadow-lg transition-all group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  {stat.subtext && <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Tarefas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.upcomingTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma tarefa pendente.</p>
            ) : (
              data.upcomingTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50">
                  <div className={`w-2 h-2 rounded-full ${task.priority === 'high' || task.priority === 'urgent' ? 'bg-destructive' : 'bg-primary'}`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}</p>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-secondary rounded-lg text-secondary-foreground">
                    {task.status.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensagens Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.recentMessages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma mensagem recebida ainda.</p>
            ) : (
              data.recentMessages.map(msg => (
                <div key={msg.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-sm">{msg.senderName}</p>
                    <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{msg.content}"</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
