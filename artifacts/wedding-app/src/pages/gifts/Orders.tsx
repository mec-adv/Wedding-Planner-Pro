import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Download, ChevronDown, ChevronRight, AlertTriangle, TrendingUp, Clock, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminOrders, fetchOrderSummary, cancelOrder, exportOrders } from "@/lib/shop-admin-api";
import type { AdminOrder } from "@/lib/shop-admin-api";
import { useAuth } from "@/hooks/use-auth";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
  refunded: { label: "Estornado", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão",
};

function OrderRow({ order, weddingId, canCancel, onCancelRequest }: {
  order: AdminOrder;
  weddingId: number;
  canCancel: boolean;
  onCancelRequest: (order: AdminOrder) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_LABELS[order.status] ?? { label: order.status, variant: "outline" as const };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition text-sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
          <div>
            <p className="font-medium text-foreground">{order.buyerName}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</p>
          </div>
          <div>
            <Badge variant={s.variant}>{s.label}</Badge>
          </div>
          <div>
            <p className="font-semibold text-foreground">{fmtBrl(order.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">
              {METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
              {order.installments > 1 && ` ${order.installments}x`}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            #{order.id}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/10 pt-3 space-y-3">
          {/* Items */}
          <div className="space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.giftNameSnapshot} ×{item.quantity}</span>
                <span className="font-medium">{fmtBrl(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {order.guestPhone && <span>Tel: {order.guestPhone}</span>}
            {order.guestEmail && <span>Email: {order.guestEmail}</span>}
            {order.asaasPaymentId && <span>Asaas: {order.asaasPaymentId}</span>}
            {order.muralMessage && <span className="col-span-2">Mural: "{order.muralMessage}"</span>}
            {order.whatsappSentAt && <span>WhatsApp enviado: {fmtDate(order.whatsappSentAt)}</span>}
            {order.emailSentAt && <span>Email enviado: {fmtDate(order.emailSentAt)}</span>}
            {order.paidAt && <span>Pago em: {fmtDate(order.paidAt)}</span>}
            {order.cancelledAt && <span>Cancelado em: {fmtDate(order.cancelledAt)}</span>}
          </div>

          {/* Actions */}
          {canCancel && (order.status === "paid" || order.status === "pending") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancelRequest(order)}
            >
              {order.status === "paid" ? "Estornar" : "Cancelar"} pedido
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);

  const canCancel = user?.role === "admin" || user?.role === "planner";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", wid, statusFilter, methodFilter, page],
    queryFn: () => fetchAdminOrders(wid, {
      status: statusFilter !== "all" ? statusFilter : undefined,
      method: methodFilter !== "all" ? methodFilter : undefined,
      page,
    }),
    enabled: !!wid,
  });

  const { data: summary } = useQuery({
    queryKey: ["admin-orders-summary", wid],
    queryFn: () => fetchOrderSummary(wid),
    enabled: !!wid,
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => cancelOrder(wid, orderId),
    onSuccess: () => {
      toast({ title: "Pedido cancelado/estornado com sucesso" });
      setCancelTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-orders", wid] });
      void queryClient.invalidateQueries({ queryKey: ["admin-orders-summary", wid] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: err.message });
    },
  });

  function handleExport() {
    window.open(exportOrders(wid, "xlsx"), "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos da Loja</h1>
          <p className="text-muted-foreground text-sm">Gestão de presentes e pagamentos</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" /> Exportar XLSX
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Total arrecadado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-green-600">{fmtBrl(summary.totalPaid)}</p>
              <p className="text-xs text-muted-foreground">{summary.countPaid} pedidos pagos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-amber-600">{fmtBrl(summary.totalPending)}</p>
              <p className="text-xs text-muted-foreground">{summary.countPending} pedidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Estornados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-red-500">{fmtBrl(summary.totalRefunded)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Package className="w-3 h-3" /> Ticket médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{fmtBrl(summary.averageTicket)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Aguardando</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="refunded">Estornado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os métodos</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="credit_card">Cartão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : !data?.orders.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.orders.map((order) => (
            <OrderRow key={order.id} order={order} weddingId={wid} canCancel={canCancel} onCancelRequest={setCancelTarget} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-sm self-center text-muted-foreground">{page} / {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {cancelTarget?.status === "paid" ? "Estornar pagamento?" : "Cancelar pedido?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.status === "paid"
                ? "O pagamento será estornado no Asaas. Esta ação não pode ser desfeita."
                : "O pedido será cancelado. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => { if (cancelTarget) cancelMutation.mutate(cancelTarget.id); }}
            >
              {cancelMutation.isPending ? "Processando…" : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
