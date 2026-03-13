import { useParams } from "wouter";
import { useListGiftOrders, useGetGiftOrdersSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Receipt, TrendingUp, Clock, AlertCircle } from "lucide-react";

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

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  credit_card: "Cartão de Crédito"
};

export default function Extract() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  
  const { data: orders, isLoading: loadingOrders } = useListGiftOrders(wid);
  const { data: summary, isLoading: loadingSummary } = useGetGiftOrdersSummary(wid);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Extrato Financeiro</h1>
        <p className="text-muted-foreground mt-1">Acompanhe os valores recebidos da lista de presentes (Asaas).</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total de Pedidos</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loadingSummary ? "..." : summary?.totalOrders || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando transações...</td></tr>
              ) : orders?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
