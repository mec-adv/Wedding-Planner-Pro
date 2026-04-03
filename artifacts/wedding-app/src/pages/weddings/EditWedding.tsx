import { useParams, Link } from "wouter";
import { useGetWedding, useUpdateWedding, ApiError } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Scale, Church, Copy } from "lucide-react";

/** Valor para input datetime-local no fuso local */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function EditWedding() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { data, isLoading, error } = useGetWedding(wid, {
    query: { enabled: Number.isFinite(wid) && wid > 0 },
  });
  const updateMutation = useUpdateWedding();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [civil, setCivil] = useState("");
  const [religious, setReligious] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setGroomName(data.groomName);
    setBrideName(data.brideName);
    setCivil(isoToDatetimeLocal(data.civilCeremonyAt ?? data.date));
    setReligious(isoToDatetimeLocal(data.religiousCeremonyAt ?? data.date));
    setVenue(data.venue ?? "");
    setDescription(data.description ?? "");
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groomName.trim() || !brideName.trim()) {
      toast({ variant: "destructive", title: "Informe os nomes do casal" });
      return;
    }
    if (!civil || !religious) {
      toast({ variant: "destructive", title: "Informe as datas da cerimônia civil e religiosa" });
      return;
    }
    const civilD = new Date(civil);
    const relD = new Date(religious);
    if (Number.isNaN(civilD.getTime()) || Number.isNaN(relD.getTime())) {
      toast({ variant: "destructive", title: "Datas inválidas" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: wid,
        data: {
          title: title.trim() || undefined,
          groomName: groomName.trim(),
          brideName: brideName.trim(),
          civilCeremonyAt: civilD.toISOString(),
          religiousCeremonyAt: relD.toISOString(),
          venue: venue.trim() || null,
          description: description.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/weddings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}`] });
      toast({ title: "Dados do casamento salvos" });
    } catch (err) {
      const full =
        err instanceof ApiError
          ? err.getFullDetails()
          : err instanceof Error
            ? err.message
            : "Tente novamente.";
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        duration: 120_000,
        description: (
          <div className="mt-1 space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 bg-background/90 text-foreground hover:bg-background"
              onClick={() => {
                void navigator.clipboard.writeText(full);
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copiar mensagem
            </Button>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs font-mono leading-snug select-text cursor-text">
              {full}
            </pre>
          </div>
        ),
      });
    }
  };

  if (!Number.isFinite(wid) || wid <= 0) {
    return (
      <div className="text-destructive">
        ID inválido. <Link href="/" className="underline">Voltar aos casamentos</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-destructive space-y-2">
        <p>Não foi possível carregar este casamento.</p>
        <Link href="/" className="text-primary underline text-sm">
          Voltar à lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href={`/weddings/${wid}/dashboard`}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-serif text-foreground">Dados do casamento</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Altere título, nomes, cerimônias civil e religiosa, local e observações.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editar informações</CardTitle>
          <CardDescription>As alterações são salvas na nuvem e refletem no dashboard e na lista.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium mb-1">Título do evento</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Casamento Ana & Bruno" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do noivo / parceiro 1</label>
                <Input value={groomName} onChange={(e) => setGroomName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nome da noiva / parceiro 2</label>
                <Input value={brideName} onChange={(e) => setBrideName(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" /> Cerimônia civil
                </label>
                <Input type="datetime-local" value={civil} onChange={(e) => setCivil(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Church className="w-3.5 h-3.5" /> Cerimônia religiosa
                </label>
                <Input type="datetime-local" value={religious} onChange={(e) => setReligious(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Local principal</label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Igreja, cartório, salão…" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Notas internas"
              />
            </div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
