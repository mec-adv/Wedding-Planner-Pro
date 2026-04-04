import { useState } from "react";
import { useParams } from "wouter";
import { useListVendors, useCreateVendor, useDeleteVendor } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Mail, Trash2, DollarSign } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneBrReadOnly } from "@/lib/phone-br";

const STATUS_LABELS: Record<string, string> = {
  contacted: "Contatado",
  negotiating: "Negociando",
  hired: "Contratado",
  rejected: "Rejeitado",
};

const STATUS_COLORS: Record<string, "info" | "warning" | "success" | "destructive"> = {
  contacted: "info",
  negotiating: "warning",
  hired: "success",
  rejected: "destructive",
};

export default function Vendors() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendors, isLoading } = useListVendors(wid);
  const createMutation = useCreateVendor();
  const deleteMutation = useDeleteVendor();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          category: fd.get("category") as string,
          contactName: fd.get("contactName") as string || null,
          phone: phoneDigits.trim() ? phoneDigits.trim() : null,
          email: fd.get("email") as string || null,
          price: fd.get("price") ? Number(fd.get("price")) : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/vendors`] });
      setIsOpen(false);
      setPhoneDigits("");
      toast({ title: "Fornecedor adicionado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao adicionar fornecedor" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este fornecedor?")) return;
    try {
      await deleteMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/vendors`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground mt-1">Gerencie os fornecedores do casamento.</p>
        </div>
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) setPhoneDigits("");
          }}
        >
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif text-xl">Adicionar Fornecedor</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Nome</label><Input name="name" required /></div>
                <div><label className="text-sm font-medium">Categoria</label><Input name="category" placeholder="Ex: Buffet, Decoração" required /></div>
              </div>
              <div><label className="text-sm font-medium">Contato</label><Input name="contactName" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Telefone</label>
                  <PhoneInput className="mt-1.5" value={phoneDigits} onDigitsChange={setPhoneDigits} />
                </div>
                <div><label className="text-sm font-medium">E-mail</label><Input name="email" type="email" /></div>
              </div>
              <div><label className="text-sm font-medium">Preço (R$)</label><Input name="price" type="number" step="0.01" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Fornecedor"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-40" /></Card>)
        ) : vendors?.length === 0 ? (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhum fornecedor cadastrado.</CardContent></Card>
        ) : vendors?.map(vendor => (
          <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{vendor.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{vendor.category}</p>
                </div>
                <Badge variant={STATUS_COLORS[vendor.status || "contacted"]}>{STATUS_LABELS[vendor.status || "contacted"]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {vendor.contactName && <p className="text-sm">{vendor.contactName}</p>}
              {vendor.phone && (
                <p className="text-sm flex items-center gap-1">
                  <Phone className="w-3 h-3 shrink-0" /> {formatPhoneBrReadOnly(vendor.phone)}
                </p>
              )}
              {vendor.email && <p className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {vendor.email}</p>}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold flex items-center gap-1"><DollarSign className="w-4 h-4" /> {formatCurrency(vendor.price ?? null)}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(vendor.id)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
