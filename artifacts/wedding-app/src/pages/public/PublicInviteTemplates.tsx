import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useListPublicInviteTemplates,
  useCreatePublicInviteTemplate,
  useUpdatePublicInviteTemplate,
  useDeletePublicInviteTemplate,
} from "@workspace/api-client-react";
import type { PublicInviteTemplate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star, Palette, Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadWeddingGiftImage } from "@/lib/upload-wedding-gift-image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { getListPublicInviteTemplatesQueryKey } from "@workspace/api-client-react";
import {
  resolvePublicInvitePageConfig,
  type PublicInvitePageConfig,
  type ResolvedPublicInvitePageConfig,
  type BotanicoPadrinho,
  type BotanicoFaqItem,
} from "./public-invite-page-config";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          className="h-9 w-12 rounded border border-input cursor-pointer bg-background p-0.5"
          value={value.length === 7 ? value : "#708238"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#708238" className="font-mono text-sm" />
      </div>
    </div>
  );
}

export default function PublicInviteTemplates() {
  const { weddingId } = useParams();
  const wid = weddingId ? Number(weddingId) : NaN;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading, isError, error } = useListPublicInviteTemplates(wid, {
    query: {
      enabled: Number.isFinite(wid) && wid > 0,
      queryKey: getListPublicInviteTemplatesQueryKey(wid),
    },
  });
  const createMut = useCreatePublicInviteTemplate();
  const updateMut = useUpdatePublicInviteTemplate();
  const deleteMut = useDeletePublicInviteTemplate();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [contentTpl, setContentTpl] = useState<PublicInviteTemplate | null>(null);
  const [pageForm, setPageForm] = useState<ResolvedPublicInvitePageConfig>(() => resolvePublicInvitePageConfig({}));
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [padrinhoImageUploading, setPadrinhoImageUploading] = useState<number | null>(null);

  useEffect(() => {
    if (contentTpl) {
      setPageForm(resolvePublicInvitePageConfig(contentTpl.config));
    }
  }, [contentTpl]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListPublicInviteTemplatesQueryKey(wid) });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Informe o nome do modelo" });
      return;
    }
    try {
      await createMut.mutateAsync({
        weddingId: wid,
        data: { name: name.trim(), isDefault, config: {} },
      });
      toast({ title: "Modelo criado" });
      setOpen(false);
      setName("");
      setIsDefault(false);
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro ao criar" });
    }
  };

  const startEdit = (id: number, n: string, def: boolean) => {
    setEditingId(id);
    setName(n);
    setIsDefault(def);
    setOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Informe o nome" });
      return;
    }
    try {
      await updateMut.mutateAsync({
        weddingId: wid,
        id: editingId,
        data: { name: name.trim(), isDefault },
      });
      toast({ title: "Modelo atualizado" });
      setOpen(false);
      setEditingId(null);
      setName("");
      setIsDefault(false);
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro ao salvar" });
    }
  };

  const savePageContent = async () => {
    if (!contentTpl?.id) return;
    try {
      await updateMut.mutateAsync({
        weddingId: wid,
        id: contentTpl.id,
        data: { config: pageForm as Record<string, unknown> },
      });
      toast({ title: "Página atualizada" });
      setContentTpl(null);
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro ao salvar" });
    }
  };

  const confirmDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteMut.mutateAsync({ weddingId: wid, id: deleteId });
      toast({ title: "Modelo excluído" });
      setDeleteId(null);
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro ao excluir" });
    }
  };

  const updateField = <K extends keyof PublicInvitePageConfig>(key: K, value: PublicInvitePageConfig[K]) => {
    setPageForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePadrinho = (index: number, field: keyof BotanicoPadrinho, value: string) => {
    setPageForm((prev) => {
      const list = [...(prev.padrinhos ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, padrinhos: list };
    });
  };

  const addPadrinho = () => {
    setPageForm((prev) => ({
      ...prev,
      padrinhos: [...(prev.padrinhos ?? []), { name: "", photoUrl: "" }],
    }));
  };

  const removePadrinho = (index: number) => {
    setPageForm((prev) => ({
      ...prev,
      padrinhos: (prev.padrinhos ?? []).filter((_, i) => i !== index),
    }));
  };

  const updateFaq = (index: number, field: keyof BotanicoFaqItem, value: string) => {
    setPageForm((prev) => {
      const list = [...(prev.faqItems ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, faqItems: list };
    });
  };

  const addFaq = () => {
    setPageForm((prev) => ({
      ...prev,
      faqItems: [...(prev.faqItems ?? []), { q: "", a: "" }],
    }));
  };

  const removeFaq = (index: number) => {
    setPageForm((prev) => ({
      ...prev,
      faqItems: (prev.faqItems ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleHeroPosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setHeroImageUploading(true);
    try {
      const url = await uploadWeddingGiftImage(wid, file);
      updateField("heroPosterImageUrl", url);
      toast({ title: "Imagem enviada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setHeroImageUploading(false);
    }
  };

  const handlePadrinhoPhotoFile = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPadrinhoImageUploading(index);
    try {
      const url = await uploadWeddingGiftImage(wid, file);
      updatePadrinho(index, "photoUrl", url);
      toast({ title: "Imagem enviada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setPadrinhoImageUploading(null);
    }
  };

  const pageSaveDisabled = updateMut.isPending || heroImageUploading || padrinhoImageUploading !== null;

  if (!Number.isFinite(wid) || wid <= 0) {
    return <p className="text-muted-foreground">Casamento inválido.</p>;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Não foi possível carregar os modelos.</p>
        <p className="text-muted-foreground mt-1">{error instanceof Error ? error.message : "Verifique sua sessão e tente novamente."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Página do Casamento</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Edite textos e cores da página pública (RSVP e lista de presentes). O modelo marcado como padrão é usado nos
            links dos convidados que não têm outro modelo atribuído em{" "}
            <Link href={`/weddings/${wid}/guests`} className="text-primary underline underline-offset-2 font-medium">
              Convidados
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            onClick={() => {
              setEditingId(null);
              setName("");
              setIsDefault(false);
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo modelo
          </Button>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditingId(null);
              setName("");
              setIsDefault(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId != null ? "Editar modelo" : "Novo modelo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tpl-name">Nome</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. Clássico, Minimalista…"
                  className="mt-1.5"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Definir como modelo padrão do casamento
              </label>
              <Button
                className="w-full"
                onClick={editingId != null ? handleSaveEdit : handleCreate}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editingId != null ? "Salvar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates?.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {tpl.name}
                    {tpl.isDefault && (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" aria-label="Padrão" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {tpl.isDefault
                      ? "Usado no link público quando o convidado não tem outro modelo."
                      : "Atribua a convidados específicos em Convidados."}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1"
                    onClick={() => setContentTpl(tpl)}
                  >
                    <Palette className="w-4 h-4" />
                    Editar página
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Renomear modelo"
                    onClick={() => {
                      startEdit(tpl.id!, tpl.name!, !!tpl.isDefault);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setDeleteId(tpl.id!)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={contentTpl != null} onOpenChange={(o) => !o && setContentTpl(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Textos e aparência — {contentTpl?.name}</DialogTitle>
          </DialogHeader>
          {contentTpl && (
            <div className="space-y-6 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Cor principal (botões, títulos)" value={pageForm.primaryColor} onChange={(v) => updateField("primaryColor", v)} />
                <ColorField label="Fundo da página" value={pageForm.backgroundColor} onChange={(v) => updateField("backgroundColor", v)} />
                <ColorField label="Pontos do fundo" value={pageForm.patternDotColor} onChange={(v) => updateField("patternDotColor", v)} />
                <ColorField label="Texto principal" value={pageForm.textColor} onChange={(v) => updateField("textColor", v)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 border-t pt-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="layout-mode">Layout da página pública</Label>
                  <select
                    id="layout-mode"
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={pageForm.layout}
                    onChange={(e) => updateField("layout", e.target.value as "classic" | "botanico")}
                  >
                    <option value="botanico">Floral (página completa com vídeo, história e padrinhos)</option>
                    <option value="classic">Simples (uma coluna, texto e RSVP)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O layout floral usa fundo claro suave, azul e dourado e ornamentos (SVG ou imagens opcionais). Edite textos e fotos abaixo.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pageForm.showCountdown}
                  onChange={(e) => updateField("showCountdown", e.target.checked)}
                />
                Mostrar contagem regressiva até a cerimônia
              </label>

              {pageForm.layout === "botanico" && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold text-foreground">Conteúdo do layout floral</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Iniciais no menu</Label>
                      <Input className="mt-1" value={pageForm.navInitials} onChange={(e) => updateField("navInitials", e.target.value)} placeholder="R & M" />
                    </div>
                    <div>
                      <Label>Linha acima dos nomes (hero)</Label>
                      <Input className="mt-1" value={pageForm.heroSubtitle} onChange={(e) => updateField("heroSubtitle", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>URL do vídeo do hero (MP4)</Label>
                      <Input className="mt-1 font-mono text-xs" value={pageForm.heroVideoUrl} onChange={(e) => updateField("heroVideoUrl", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Imagem de capa / poster (JPG, PNG ou WebP)
                      </Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        onChange={handleHeroPosterFile}
                        disabled={heroImageUploading}
                        className="cursor-pointer"
                      />
                      {heroImageUploading && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" /> Enviando…
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Ou informe uma URL externa:</p>
                      <Input
                        className="font-mono text-xs"
                        value={pageForm.heroPosterImageUrl}
                        onChange={(e) => updateField("heroPosterImageUrl", e.target.value)}
                        placeholder="https://..."
                        autoComplete="off"
                      />
                      {pageForm.heroPosterImageUrl ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => updateField("heroPosterImageUrl", "")}>
                          Remover imagem
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Imagens decorativas (opcional)</p>
                    <p className="text-xs text-muted-foreground">
                      Se preenchidas, substituem os ornamentos SVG embutidos. Use URLs absolutas (PNG/WebP).
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Textura de fundo (full-bleed)</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoBgTextureUrl}
                          onChange={(e) => updateField("botanicoBgTextureUrl", e.target.value)}
                          placeholder="https://…"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Guirlanda do hero</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoHeroGarlandUrl}
                          onChange={(e) => updateField("botanicoHeroGarlandUrl", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Divisores (seções)</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoDividerUrl}
                          onChange={(e) => updateField("botanicoDividerUrl", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ramos laterais / coluna</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoColumnFloralUrl}
                          onChange={(e) => updateField("botanicoColumnFloralUrl", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cantos</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoCornerFloralUrl}
                          onChange={(e) => updateField("botanicoCornerFloralUrl", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Rodapé (guirlanda)</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoFooterGarlandUrl}
                          onChange={(e) => updateField("botanicoFooterGarlandUrl", e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Floreio acima dos padrinhos</Label>
                        <Input
                          className="mt-1 font-mono text-xs"
                          value={pageForm.botanicoPadrinhoFlourishUrl}
                          onChange={(e) => updateField("botanicoPadrinhoFlourishUrl", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Título da história</Label>
                    <Input className="mt-1" value={pageForm.historiaTitle} onChange={(e) => updateField("historiaTitle", e.target.value)} />
                  </div>
                  <div>
                    <Label>Texto da história</Label>
                    <Textarea className="mt-1" rows={5} value={pageForm.historiaBody} onChange={(e) => updateField("historiaBody", e.target.value)} />
                  </div>
                  <div>
                    <Label>Linha “desde” (ex.: desde 17/02/2019)</Label>
                    <Input className="mt-1" value={pageForm.historiaSince} onChange={(e) => updateField("historiaSince", e.target.value)} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Nome do local (cerimônia)</Label>
                      <Input className="mt-1" value={pageForm.cerimoniaLocalNome} onChange={(e) => updateField("cerimoniaLocalNome", e.target.value)} />
                    </div>
                    <div>
                      <Label>Horário (texto livre, opcional)</Label>
                      <Input className="mt-1" value={pageForm.horarioCerimoniaText} onChange={(e) => updateField("horarioCerimoniaText", e.target.value)} placeholder="Se vazio, usa o horário do cadastro" />
                    </div>
                  </div>
                  <div>
                    <Label>Mapa (URL do Google Maps)</Label>
                    <Input className="mt-1 font-mono text-xs" value={pageForm.mapEmbedUrl} onChange={(e) => updateField("mapEmbedUrl", e.target.value)} placeholder="https://www.google.com/maps/embed?pb=..." />
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Para o mapa aparecer na página, use <strong>Incorporar mapa</strong> no Google Maps e cole o link que
                      começa com <code className="text-[11px] bg-muted px-1 rounded">/maps/embed?</code>. O link normal de
                      Compartilhar abre em botão &quot;Abrir localização&quot; no convite.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Título bloco dicas</Label>
                      <Input className="mt-1" value={pageForm.eventoBlocoDicasTitle} onChange={(e) => updateField("eventoBlocoDicasTitle", e.target.value)} />
                    </div>
                    <div>
                      <Label>Título padrinhos</Label>
                      <Input className="mt-1" value={pageForm.padrinhosTitle} onChange={(e) => updateField("padrinhosTitle", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Traje — título</Label>
                    <Input className="mt-1" value={pageForm.dicaTrajeTitle} onChange={(e) => updateField("dicaTrajeTitle", e.target.value)} />
                  </div>
                  <div>
                    <Label>Traje — texto</Label>
                    <Textarea className="mt-1" rows={2} value={pageForm.dicaTrajeBody} onChange={(e) => updateField("dicaTrajeBody", e.target.value)} />
                  </div>
                  <div>
                    <Label>Estacionamento — título</Label>
                    <Input className="mt-1" value={pageForm.dicaEstacionamentoTitle} onChange={(e) => updateField("dicaEstacionamentoTitle", e.target.value)} />
                  </div>
                  <div>
                    <Label>Estacionamento — texto</Label>
                    <Textarea className="mt-1" rows={2} value={pageForm.dicaEstacionamentoBody} onChange={(e) => updateField("dicaEstacionamentoBody", e.target.value)} />
                  </div>
                  <div>
                    <Label>Crianças — título</Label>
                    <Input className="mt-1" value={pageForm.dicaCriancasTitle} onChange={(e) => updateField("dicaCriancasTitle", e.target.value)} />
                  </div>
                  <div>
                    <Label>Crianças — texto</Label>
                    <Textarea className="mt-1" rows={2} value={pageForm.dicaCriancasBody} onChange={(e) => updateField("dicaCriancasBody", e.target.value)} />
                  </div>
                  <div>
                    <Label>Rótulo dos segundos (contagem)</Label>
                    <Input className="mt-1" value={pageForm.countdownSecondLabel} onChange={(e) => updateField("countdownSecondLabel", e.target.value)} />
                  </div>
                  <div>
                    <Label>Frase extra na lista de presentes</Label>
                    <Input className="mt-1" value={pageForm.listaPresentesIntro} onChange={(e) => updateField("listaPresentesIntro", e.target.value)} />
                  </div>
                  <div>
                    <Label>Observação sobre presentes</Label>
                    <Textarea className="mt-1" rows={2} value={pageForm.giftsPresentesDisclaimer} onChange={(e) => updateField("giftsPresentesDisclaimer", e.target.value)} />
                  </div>
                  <div>
                    <Label>URL da página de presentes (abre em nova aba)</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={pageForm.giftsExternalPageUrl}
                      onChange={(e) => updateField("giftsExternalPageUrl", e.target.value)}
                      placeholder="presentes.html"
                    />
                  </div>
                  <div>
                    <Label>Título FAQ</Label>
                    <Input className="mt-1" value={pageForm.faqTitle} onChange={(e) => updateField("faqTitle", e.target.value)} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Padrinhos (nome e foto)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addPadrinho}>
                        Adicionar
                      </Button>
                    </div>
                    {(pageForm.padrinhos ?? []).map((p, i) => (
                      <div key={i} className="grid sm:grid-cols-2 gap-2 border rounded-md p-3 bg-background">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Nome</Label>
                          <Input className="mt-1" value={p.name} onChange={(e) => updatePadrinho(i, "name", e.target.value)} />
                        </div>
                        <div className="sm:col-span-2 space-y-2">
                          <Label className="text-xs flex items-center gap-2">
                            <ImageIcon className="w-3 h-3" /> Foto (JPG, PNG ou WebP)
                          </Label>
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => void handlePadrinhoPhotoFile(i, e)}
                            disabled={padrinhoImageUploading === i}
                            className="cursor-pointer"
                          />
                          {padrinhoImageUploading === i && (
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" /> Enviando…
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">Ou informe uma URL externa:</p>
                          <Input
                            className="font-mono text-xs"
                            value={p.photoUrl}
                            onChange={(e) => updatePadrinho(i, "photoUrl", e.target.value)}
                            placeholder="https://..."
                            autoComplete="off"
                          />
                          {p.photoUrl ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => updatePadrinho(i, "photoUrl", "")}>
                              Remover imagem
                            </Button>
                          ) : null}
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removePadrinho(i)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>FAQ</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addFaq}>
                        Adicionar pergunta
                      </Button>
                    </div>
                    {(pageForm.faqItems ?? []).map((item, i) => (
                      <div key={i} className="space-y-2 border rounded-md p-3 bg-background">
                        <div>
                          <Label className="text-xs">Pergunta</Label>
                          <Input className="mt-1" value={item.q} onChange={(e) => updateFaq(i, "q", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Resposta</Label>
                          <Textarea className="mt-1" rows={2} value={item.a} onChange={(e) => updateFaq(i, "a", e.target.value)} />
                        </div>
                        <div className="flex justify-end">
                          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeFaq(i)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-foreground">Capa</h3>
                <div>
                  <Label>Faixa superior</Label>
                  <Input className="mt-1" value={pageForm.heroTagline} onChange={(e) => updateField("heroTagline", e.target.value)} />
                </div>
                <div>
                  <Label>Botão (âncora RSVP)</Label>
                  <Input className="mt-1" value={pageForm.ctaRsvp} onChange={(e) => updateField("ctaRsvp", e.target.value)} />
                </div>
                <div>
                  <Label>Mensagem após a data do casamento</Label>
                  <Input className="mt-1" value={pageForm.mensagemAposCerimonia} onChange={(e) => updateField("mensagemAposCerimonia", e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-foreground">O grande dia</h3>
                <div>
                  <Label>Título da seção</Label>
                  <Input className="mt-1" value={pageForm.sectionGrandeDiaTitle} onChange={(e) => updateField("sectionGrandeDiaTitle", e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Bloco local &amp; data</Label>
                    <Input className="mt-1" value={pageForm.blockCerimoniaTitle} onChange={(e) => updateField("blockCerimoniaTitle", e.target.value)} />
                  </div>
                  <div>
                    <Label>Bloco sobre o evento</Label>
                    <Input className="mt-1" value={pageForm.blockEventoTitle} onChange={(e) => updateField("blockEventoTitle", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Texto de traje / observações</Label>
                  <Textarea className="mt-1" rows={2} value={pageForm.dressCodeText} onChange={(e) => updateField("dressCodeText", e.target.value)} />
                </div>
                <div>
                  <Label>Texto quando não houver descrição do casamento</Label>
                  <Input className="mt-1" value={pageForm.emptyDescriptionFallback} onChange={(e) => updateField("emptyDescriptionFallback", e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-foreground">RSVP</h3>
                <div>
                  <Label>Título</Label>
                  <Input className="mt-1" value={pageForm.rsvpSectionTitle} onChange={(e) => updateField("rsvpSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Subtítulo</Label>
                  <Input className="mt-1" value={pageForm.rsvpSectionSubtitle} onChange={(e) => updateField("rsvpSectionSubtitle", e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Título após enviar</Label>
                    <Input className="mt-1" value={pageForm.rsvpSuccessTitle} onChange={(e) => updateField("rsvpSuccessTitle", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Mensagem após enviar</Label>
                  <Textarea className="mt-1" rows={2} value={pageForm.rsvpSuccessMessage} onChange={(e) => updateField("rsvpSuccessMessage", e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-foreground">Presentes</h3>
                <div>
                  <Label>Título</Label>
                  <Input className="mt-1" value={pageForm.giftsSectionTitle} onChange={(e) => updateField("giftsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Frase de abertura</Label>
                  <Input className="mt-1" value={pageForm.giftsTagline} onChange={(e) => updateField("giftsTagline", e.target.value)} />
                </div>
                <div>
                  <Label>Lista vazia</Label>
                  <Input className="mt-1" value={pageForm.giftsEmptyMessage} onChange={(e) => updateField("giftsEmptyMessage", e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-foreground">Rodapé</h3>
                <div>
                  <Label>Linha abaixo dos nomes</Label>
                  <Input className="mt-1" value={pageForm.footerLine2} onChange={(e) => updateField("footerLine2", e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setContentTpl(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void savePageContent()} disabled={pageSaveDisabled}>
              {updateMut.isPending ? "Salvando…" : "Salvar na página publicada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>Convidados que usavam este modelo podem passar a ver o modelo padrão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
