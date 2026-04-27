import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminCategories, createCategory, updateCategory, deleteCategory,
} from "@/lib/shop-admin-api";
import type { GiftCategory } from "@/lib/shop-admin-api";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function GiftCategoriesPanel({ weddingId: wid, embedded = false }: { weddingId: number; embedded?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GiftCategory | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["gift-categories-admin", wid],
    queryFn: () => fetchAdminCategories(wid),
    enabled: !!wid,
  });

  const categories = data?.categories ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["gift-categories-admin", wid] });

  const createMutation = useMutation({
    mutationFn: () => createCategory(wid, newName.trim(), newOrder ? Number(newOrder) : undefined),
    onSuccess: () => { toast({ title: "Categoria criada" }); setNewName(""); setNewOrder(""); invalidate(); },
    onError: (err: Error) => toast({ variant: "destructive", title: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => updateCategory(wid, id, { name: editName.trim(), sortOrder: editOrder ? Number(editOrder) : undefined }),
    onSuccess: () => { toast({ title: "Categoria atualizada" }); setEditingId(null); invalidate(); },
    onError: (err: Error) => toast({ variant: "destructive", title: err.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updateCategory(wid, id, { active }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast({ variant: "destructive", title: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(wid, id),
    onSuccess: () => { toast({ title: "Categoria excluída" }); setDeleteTarget(null); invalidate(); },
    onError: (err: Error) => toast({ variant: "destructive", title: err.message }),
  });

  function startEdit(cat: GiftCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditOrder(String(cat.sortOrder));
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias de Presentes</h1>
          <p className="text-muted-foreground text-sm">Organize os presentes em categorias para facilitar a navegação na loja</p>
        </div>
      )}

      {/* Add new */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" /> Nova Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(); }}
            />
            <Input
              type="number"
              placeholder="Ordem"
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              className="w-24"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="shrink-0"
            >
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4" /> Categorias ({categories.length})
          </CardTitle>
          <CardDescription>Arraste para reordenar (em breve). Use o campo Ordem para definir a posição.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 italic">Nenhuma categoria criada ainda.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className={`flex items-center gap-3 p-3 border rounded-lg ${!cat.active ? "opacity-50" : ""}`}>
                  {editingId === cat.id ? (
                    <>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                      <Input type="number" value={editOrder} onChange={(e) => setEditOrder(e.target.value)} className="w-20" />
                      <Button size="icon" variant="ghost" onClick={() => updateMutation.mutate({ id: cat.id })}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground w-8 text-center">#{cat.sortOrder}</span>
                      <button
                        type="button"
                        className="text-xs underline text-muted-foreground hover:text-foreground"
                        onClick={() => toggleActiveMutation.mutate({ id: cat.id, active: !cat.active })}
                      >
                        {cat.active ? "Desativar" : "Ativar"}
                      </button>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(cat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(cat)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Presentes associados a esta categoria perderão a categoria. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function GiftCategories() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  return <GiftCategoriesPanel weddingId={wid} />;
}
