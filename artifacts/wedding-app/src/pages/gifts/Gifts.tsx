import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import {
  useListGifts,
  useCreateGift,
  useUpdateGift,
  useDeleteGift,
  type Gift,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import {
  Gift as GiftIcon,
  Plus,
  Image as ImageIcon,
  Sparkles,
  Pencil,
  Trash2,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { uploadWeddingGiftImage } from "@/lib/upload-wedding-gift-image";

const CATEGORY_LABELS: Record<string, string> = {
  viagem: "Viagem",
  casa: "Casa Nova",
  experiencia: "Experiência",
};

function formatGiftCategory(category: string): string {
  if (!category?.trim()) return "Sem categoria";
  return CATEGORY_LABELS[category] ?? category;
}

type GiftsViewMode = "grid" | "list";

function readStoredViewMode(weddingId: number): GiftsViewMode {
  try {
    const v = localStorage.getItem(`gifts-view-${weddingId}`);
    if (v === "list" || v === "grid") return v;
  } catch {
    /* ignore */
  }
  return "grid";
}

export default function Gifts() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const [isOpen, setIsOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [imageUrlValue, setImageUrlValue] = useState("");
  const [fileUploading, setFileUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Gift | null>(null);
  const [viewMode, setViewMode] = useState<GiftsViewMode>(() => readStoredViewMode(wid));
  const { toast } = useToast();

  useEffect(() => {
    setViewMode(readStoredViewMode(wid));
  }, [wid]);

  useEffect(() => {
    try {
      localStorage.setItem(`gifts-view-${wid}`, viewMode);
    } catch {
      /* ignore */
    }
  }, [wid, viewMode]);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: gifts, isLoading } = useListGifts(wid);
  const createMutation = useCreateGift();
  const updateMutation = useUpdateGift();
  const deleteMutation = useDeleteGift();

  const canEditGift =
    user?.role === "admin" || user?.role === "planner" || user?.role === "coordinator";
  const canDeleteGift = user?.role === "admin" || user?.role === "planner";

  const resetFormState = useCallback(() => {
    setEditingGift(null);
    setImageUrlValue("");
  }, []);

  const openCreate = () => {
    resetFormState();
    setIsOpen(true);
  };

  const openEdit = (gift: Gift) => {
    setEditingGift(gift);
    setImageUrlValue(gift.imageUrl?.trim() ?? "");
    setIsOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetFormState();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileUploading(true);
    try {
      const url = await uploadWeddingGiftImage(wid, file);
      setImageUrlValue(url);
      toast({ title: "Imagem enviada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setFileUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string)?.trim() ?? "";
    const price = Number(fd.get("price"));
    const category = (fd.get("category") as string) ?? "";
    const humorRaw = (fd.get("humorTag") as string)?.trim();
    const humorTag = humorRaw || null;
    const finalImageUrl = imageUrlValue.trim() || null;

    const payload = {
      name,
      category,
      price,
      humorTag,
      imageUrl: finalImageUrl,
      isActive: true,
    };

    try {
      if (editingGift) {
        await updateMutation.mutateAsync({
          weddingId: wid,
          id: editingGift.id,
          data: payload,
        });
        toast({ title: "Presente atualizado" });
      } else {
        await createMutation.mutateAsync({
          weddingId: wid,
          data: payload,
        });
        toast({ title: "Presente adicionado com sucesso" });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/gifts`] });
      handleDialogOpenChange(false);
    } catch {
      toast({
        variant: "destructive",
        title: editingGift ? "Erro ao atualizar" : "Erro ao adicionar",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ weddingId: wid, id: deleteTarget.id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/gifts`] });
      toast({ title: "Presente removido" });
      setDeleteTarget(null);
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover presente" });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary/5 p-6 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/20 rounded-2xl">
            <GiftIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif text-foreground">Lista de Presentes</h1>
            <p className="text-muted-foreground mt-1">Crie experiências divertidas para seus convidados.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch sm:items-end gap-2">
          {canEditGift ? (
            <>
              <Button type="button" className="rounded-full shadow-md" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Novo Presente
              </Button>
              <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                {editingGift ? "Editar presente" : "Adicionar Experiência/Presente"}
              </DialogTitle>
            </DialogHeader>
            <form
              key={editingGift?.id ?? "create"}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Nome do Presente</label>
                <Input
                  name="name"
                  required
                  placeholder="Ex: Jantar nas Maldivas"
                  defaultValue={editingGift?.name ?? ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input
                    name="price"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingGift != null ? String(editingGift.price) : ""}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <select
                    name="category"
                    className="flex h-11 w-full rounded-xl border-2 border-border/60 bg-background px-4 py-2 text-sm"
                    defaultValue={editingGift?.category ?? ""}
                  >
                    <option value="">Sem categoria</option>
                    <option value="viagem">Viagem</option>
                    <option value="casa">Casa Nova</option>
                    <option value="experiencia">Experiência</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Comentário (opcional)
                </label>
                <Input
                  name="humorTag"
                  placeholder="Ex: Uma lembrança para o casal"
                  defaultValue={editingGift?.humorTag ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Imagem (JPG, PNG ou WebP)
                </Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  disabled={fileUploading}
                  className="cursor-pointer"
                />
                {fileUploading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Enviando…
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Ou informe uma URL externa:</p>
                <Input
                  placeholder="https://..."
                  value={imageUrlValue}
                  onChange={(ev) => setImageUrlValue(ev.target.value)}
                  autoComplete="off"
                />
                {imageUrlValue ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => setImageUrlValue("")}
                  >
                    Remover imagem
                  </Button>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={saving || fileUploading}>
                {saving ? "Salvando..." : editingGift ? "Salvar alterações" : "Salvar Presente"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
            </>
          ) : null}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este presente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Pedidos já vinculados podem ficar inconsistentes — use com cuidado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : gifts?.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground mb-4">
            Sua lista está vazia. Adicione cotas de lua de mel ou presentes divertidos!
          </p>
          {canEditGift ? (
            <Button onClick={openCreate} variant="outline">
              Começar a criar
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">Visualização</span>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                if (v === "grid" || v === "list") setViewMode(v);
              }}
              variant="outline"
              className="justify-end"
              aria-label="Modo de visualização dos presentes"
            >
              <ToggleGroupItem value="grid" aria-label="Grade">
                <LayoutGrid className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Grade</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Lista">
                <List className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Lista</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {gifts?.map((gift) => (
                <Card
                  key={gift.id}
                  className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group"
                >
                  <div className="aspect-video bg-secondary relative overflow-hidden">
                    {gift.imageUrl ? (
                      <img
                        src={gift.imageUrl}
                        alt={gift.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/40">
                        <GiftIcon className="w-12 h-12" />
                      </div>
                    )}
                    {(canEditGift || canDeleteGift) ? (
                      <div className="absolute top-3 right-3 flex gap-1">
                        {canEditGift ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-background/90 shadow-sm"
                            onClick={() => openEdit(gift)}
                            aria-label="Editar presente"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        ) : null}
                        {canDeleteGift ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-background/90 shadow-sm text-destructive"
                            onClick={() => setDeleteTarget(gift)}
                            aria-label="Excluir presente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="absolute bottom-3 right-3">
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur font-bold shadow-sm">
                        {formatCurrency(gift.price)}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-serif text-lg font-semibold text-foreground line-clamp-1">{gift.name}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                      {formatGiftCategory(gift.category)}
                    </p>

                    {gift.humorTag ? (
                      <div className="mt-3 p-2 bg-secondary/50 rounded-lg border border-primary/10">
                        <p className="text-sm italic text-foreground flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          {gift.humorTag}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-3 list-none p-0 m-0" role="list">
              {gifts?.map((gift) => (
                <li key={gift.id}>
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-stretch">
                      <div className="relative h-40 sm:h-auto sm:w-40 shrink-0 bg-secondary border-b sm:border-b-0 sm:border-r border-border/60">
                        {gift.imageUrl ? (
                          <img
                            src={gift.imageUrl}
                            alt={gift.name}
                            className="h-full w-full object-cover sm:min-h-[7rem]"
                          />
                        ) : (
                          <div className="h-full w-full min-h-[10rem] sm:min-h-[7rem] flex items-center justify-center bg-primary/5 text-primary/40">
                            <GiftIcon className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                      <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-serif text-lg font-semibold text-foreground">{gift.name}</h3>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            {formatGiftCategory(gift.category)}
                          </p>
                          {gift.humorTag ? (
                            <p className="text-sm text-muted-foreground line-clamp-2 flex items-start gap-2 pt-1">
                              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <span className="italic text-foreground">{gift.humorTag}</span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center sm:shrink-0 border-t sm:border-t-0 border-border/60 pt-3 sm:pt-0">
                          <Badge variant="secondary" className="font-bold text-base px-3 py-1">
                            {formatCurrency(gift.price)}
                          </Badge>
                          {(canEditGift || canDeleteGift) ? (
                            <div className="flex gap-1">
                              {canEditGift ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => openEdit(gift)}
                                >
                                  <Pencil className="w-4 h-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Editar</span>
                                </Button>
                              ) : null}
                              {canDeleteGift ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(gift)}
                                >
                                  <Trash2 className="w-4 h-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Excluir</span>
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
