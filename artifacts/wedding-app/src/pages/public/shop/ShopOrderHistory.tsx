import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, QrCode, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchGuestOrders } from "@/lib/shop-api";
import type { GuestOrder } from "@/lib/shop-api";

const oliva = "#708238";
const creme = "#FDFCF8";
const grafite = "#333333";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aguardando pagamento", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
  refunded: { label: "Estornado", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
};

function OrderCard({ order, primaryColor }: { order: GuestOrder; primaryColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_LABELS[order.status] ?? { label: order.status, variant: "outline" as const };
  const total = order.totalAmount;
  const isPendingPix = order.status === "pending" && order.paymentMethod === "pix";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant={status.variant} style={status.variant === "default" ? { backgroundColor: primaryColor, color: "#fff" } : {}}>
              {status.label}
            </Badge>
            <span className="text-xs text-gray-400">{fmtDate(order.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <span className="font-semibold" style={{ color: primaryColor }}>{fmtBrl(total)}</span>
            <span className="text-gray-400">•</span>
            <span>{METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
            {order.installments > 1 && <span className="text-gray-400">{order.installments}x</span>}
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {/* Items */}
          <div className="space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.giftNameSnapshot} ×{item.quantity}</span>
                <span className="font-medium">{fmtBrl(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* PIX pending notice */}
          {isPendingPix && (
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Pagamento PIX pendente — acesse seu app do banco para completar o pagamento.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShopOrderHistory() {
  const { token } = useParams<{ token: string }>();
  const primaryColor = oliva;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["guest-orders", token],
    queryFn: () => fetchGuestOrders(token ?? ""),
    enabled: !!token && token.length >= 32,
  });

  const orders = data?.orders ?? [];

  return (
    <div className="min-h-screen antialiased" style={{ backgroundColor: creme, color: grafite, fontFamily: "'Lato', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/p/convite/${token}`}>
          <button type="button" className="flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition" style={{ color: primaryColor }}>
            <ArrowLeft className="w-4 h-4" />
            Voltar ao convite
          </button>
        </Link>

        <h1 className="text-3xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
          Meus Pedidos
        </h1>
        <p className="text-sm text-gray-500 mb-8">Histórico de presentes enviados</p>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        )}

        {isError && (
          <p className="text-center text-gray-400 italic py-12">Não foi possível carregar os pedidos.</p>
        )}

        {!isLoading && !isError && orders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 italic">Você ainda não fez nenhum pedido.</p>
            <Link href={`/p/convite/${token}`}>
              <Button className="mt-4 text-white rounded-full" style={{ backgroundColor: primaryColor }}>
                Ver lista de presentes
              </Button>
            </Link>
          </div>
        )}

        {orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} primaryColor={primaryColor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
