import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareHeart, ShoppingBag, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchMuralMessages } from "@/lib/shop-admin-api";
import type { MuralMessage } from "@/lib/shop-admin-api";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MuralCard({ msg }: { msg: MuralMessage }) {
  return (
    <div className="p-4 border rounded-lg bg-card space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {msg.source === "checkout" ? (
            <ShoppingBag className="w-4 h-4 text-primary" />
          ) : (
            <Heart className="w-4 h-4 text-pink-500" />
          )}
          <span className="font-medium text-sm text-foreground">{msg.authorName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={msg.source === "checkout" ? "default" : "secondary"}>
            {msg.source === "checkout" ? "Compra" : "Página pública"}
          </Badge>
          <span className="text-xs text-muted-foreground">{fmtDate(msg.createdAt)}</span>
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">"{msg.message}"</p>
      {msg.orderId && (
        <p className="text-xs text-muted-foreground">Vinculado ao pedido #{msg.orderId}</p>
      )}
    </div>
  );
}

export default function Mural() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["mural-messages", wid, sourceFilter],
    queryFn: () => fetchMuralMessages(wid, { source: sourceFilter !== "all" ? sourceFilter : undefined }),
    enabled: !!wid,
  });

  const messages = data?.messages ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mural de Mensagens</h1>
        <p className="text-muted-foreground text-sm">Mensagens enviadas pelos convidados</p>
      </div>

      <div className="flex gap-3">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="checkout">Compras</SelectItem>
            <SelectItem value="public_page">Página pública</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{messages.length} mensagem(ns)</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquareHeart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma mensagem ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => <MuralCard key={msg.id} msg={msg} />)}
        </div>
      )}
    </div>
  );
}
