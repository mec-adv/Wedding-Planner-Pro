import { useParams } from "wouter";
import { useListGiftOrders, useGetGiftOrdersSummary, useUpdateWithdrawalStatus, type UpdateWithdrawalStatusBodyStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Receipt, TrendingUp, Clock, AlertCircle, Wallet, ArrowDownToLine, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, "warning" | "success" | "destructive" | "default"> = {
  pending: "warning",
  confirmed: "success",
  failed: "destructive",
  refunded: "default"
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando Pagamento",
  confirmed: "Confirmado / Recebido",
  failed: "Falhou",
  refunded: "Reembolsado"
};

const WITHDRAWAL_COLORS: Record<string, "warning" | "success" | "default"> = {
  pending: "warning",
  available: "success",
  withdrawn: "default"
};

const WITHDRAWAL_LABELS: Record<string, string> = {
  pending: "Aguardando",
  available: "Disponível p/ Saque",
  withdrawn: "Sacado"
};

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  credit_card: "Cartão de Crédito"
};

export default function Extract() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: orders, isLoading: loadingOrders } = useListGiftOrders(wid);
  const { data: summary, isLoading: loadingSummary } = useGetGiftOrdersSummary(wid);
  const withdrawalMutation = useUpdateWithdrawalStatus();

  const handleWithdrawal = async (orderId: number, status: string) => {
    try {
      await withdrawalMutation.mutateAsync({ weddingId: wid, orderId, data: { status: status as UpdateWithdrawalStatusBodyStatus } });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/gift-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/gift-orders/summary`] });
      toast({ title: status === "withdrawn" ? "Saque registrado" : "Status atualizado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar status de saque" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Extrato Financeiro</h1>
        <p className="text-muted-foreground mt-1">Acompanhe os valores recebidos e saques da lista de presentes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Recebido</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {loadingSummary ? "..." : formatCurrency(summary?.totalReceived || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-600 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aguardando Pagamento</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {loadingSummary ? "..." : formatCurrency(summary?.totalPending || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-600 rounded-2xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Disponível p/ Saque</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {loadingSummary ? "..." : formatCurrency(summary?.totalAvailable || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-violet-500/5 border-violet-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-violet-500/20 text-violet-600 rounded-2xl">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Sacado</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">
                {loadingSummary ? "..." : formatCurrency(summary?.totalWithdrawn || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="border-b border-border/50">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            <CardTitle>Total de Pedidos: {loadingSummary ? "..." : summary?.totalOrders || 0}</CardTitle>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/50">
          <CardTitle>Histórico de Transações</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Convidado</th>
                <th className="px-6 py-4 font-semibold">Presente</th>
                <th className="px-6 py-4 font-semibold">Método</th>
                <th className="px-6 py-4 font-semibold">Valor</th>
                <th className="px-6 py-4 font-semibold">Pagamento</th>
                <th className="px-6 py-4 font-semibold">Saque</th>
                <th className="px-6 py-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando transações...</td></tr>
              ) : orders?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : orders?.map((order) => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {order.guestName}
                    {order.guestEmail && <span className="block text-xs font-normal text-muted-foreground">{order.guestEmail}</span>}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={order.giftName || 'Contribuição Livre'}>
                    {order.giftName || 'Contribuição Livre'}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-medium">
                    {METHOD_LABELS[order.paymentMethod]}
                  </td>
                  <td className="px-6 py-4 font-bold text-foreground whitespace-nowrap">
                    {formatCurrency(order.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={STATUS_COLORS[order.paymentStatus]}>
                      {STATUS_LABELS[order.paymentStatus]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={WITHDRAWAL_COLORS[order.withdrawalStatus]}>
                      {WITHDRAWAL_LABELS[order.withdrawalStatus]}
                    </Badge>
                    {order.withdrawnAt && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        {new Date(order.withdrawnAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {order.paymentStatus === "confirmed" && order.withdrawalStatus === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWithdrawal(order.id, "available")}
                        disabled={withdrawalMutation.isPending}
                      >
                        <Wallet className="w-3 h-3 mr-1" /> Liberar
                      </Button>
                    )}
                    {order.paymentStatus === "confirmed" && order.withdrawalStatus === "available" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleWithdrawal(order.id, "withdrawn")}
                        disabled={withdrawalMutation.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Sacar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
