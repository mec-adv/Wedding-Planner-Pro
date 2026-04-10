import { useState, useRef, useEffect } from "react";
import { useImportGuests, getListGuestsQueryKey } from "@workspace/api-client-react";
import type { GuestGroup } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { parseCsv, guestImportRowsToInputs } from "@/lib/guests-csv";
import type { GuestInput } from "@workspace/api-client-react";

interface GuestImportDialogProps {
  weddingId: number;
  guestGroups: GuestGroup[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuestImportDialog({
  weddingId,
  guestGroups,
  open,
  onOpenChange,
}: GuestImportDialogProps) {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [readyGuests, setReadyGuests] = useState<GuestInput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const importMutation = useImportGuests();

  const reset = () => {
    setFileContent(null);
    setReadyGuests([]);
    setWarnings([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!open || fileContent === null) return;
    const matrix = parseCsv(fileContent);
    const { guests: g, warnings: w } = guestImportRowsToInputs(matrix, guestGroups);
    setWarnings(w);
    setReadyGuests(g);
    if (g.length === 0) {
      const primary =
        w.find((x) => x.includes("Cabeçalho")) ??
        w.find((x) => x.includes("Arquivo vazio")) ??
        w[0] ??
        "Nenhum convidado válido no arquivo.";
      setParseError(primary);
    } else {
      setParseError(null);
    }
  }, [open, fileContent, guestGroups]);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileContent(null);
    setReadyGuests([]);
    setWarnings([]);
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result ?? "");
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      setFileContent(text);
    };
    reader.onerror = () => setParseError("Não foi possível ler o arquivo.");
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (readyGuests.length === 0) return;
    try {
      const result = await importMutation.mutateAsync({
        weddingId,
        data: { guests: readyGuests },
      });
      await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(weddingId) });
      const msg = `Importados: ${result.imported}. Erros: ${result.errors}.`;
      toast({
        title: "Importação concluída",
        description: result.messages.length ? result.messages.slice(0, 5).join(" · ") : msg,
      });
      if (warnings.length) {
        toast({
          title: "Avisos do arquivo",
          description: warnings.slice(0, 8).join(" · "),
        });
      }
      onOpenChange(false);
      reset();
    } catch {
      toast({ variant: "destructive", title: "Erro ao importar convidados" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Importar convidados (CSV)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Uma linha por convidado titular. Colunas:{" "}
          <strong>nome</strong> (obrigatório), <strong>email</strong>, <strong>whatsapp</strong>,{" "}
          <strong>grupo</strong> (nome do grupo), <strong>convidado_por</strong> (noivo, noiva, groom ou
          bride), <strong>observacoes</strong>. Acompanhantes são cadastrados na confirmação.
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Arquivo</label>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelected}
            className="cursor-pointer"
          />
        </div>
        {guestGroups == null && fileContent !== null && (
          <p className="text-xs text-muted-foreground">Carregando grupos para validar nomes…</p>
        )}
        {parseError && (
          <p className="text-sm text-destructive" role="alert">
            {parseError}
          </p>
        )}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-100 max-h-36 overflow-y-auto space-y-1">
            <p className="font-medium">Avisos</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {readyGuests.length > 0 && (
          <p className="text-sm text-foreground">
            <strong>{readyGuests.length}</strong> convidado(s) pronto(s) para importar.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={readyGuests.length === 0 || importMutation.isPending || guestGroups == null}
          >
            {importMutation.isPending ? "Importando…" : "Importar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
