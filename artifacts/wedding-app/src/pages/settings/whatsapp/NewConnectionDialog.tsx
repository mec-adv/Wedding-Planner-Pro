import { useEffect, useMemo, useState } from "react";
import {
  useCreateWhatsappConnection,
  useGetWhatsappConnectionStatus,
  getGetWhatsappConnectionStatusQueryKey,
  getListWhatsappConnectionsQueryKey,
  useGetWedding,
  type WhatsappConnectionCreateResult,
  type WhatsappOwnerKind,
} from "@workspace/api-client-react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Heart, User, CalendarDays, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weddingId: number;
}

type Step = "owner" | "instance" | "qr";

const OWNER_OPTIONS: Array<{
  kind: WhatsappOwnerKind;
  title: string;
  description: string;
  icon: typeof Heart;
}> = [
  {
    kind: "bride",
    title: "Noiva",
    description: "Número pessoal da noiva.",
    icon: Heart,
  },
  {
    kind: "groom",
    title: "Noivo",
    description: "Número pessoal do noivo.",
    icon: User,
  },
  {
    kind: "event",
    title: "Evento",
    description: "Número dedicado ao casamento (padrão para avisos e notificações).",
    icon: CalendarDays,
  },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 40);
}

function suggestInstanceName(
  weddingId: number,
  ownerKind: WhatsappOwnerKind,
  bride: string | undefined,
  groom: string | undefined,
): string {
  const base =
    ownerKind === "bride"
      ? bride
      : ownerKind === "groom"
        ? groom
        : `evento-${weddingId}`;
  const slug = slugify(base || ownerKind);
  return `casamento-${weddingId}-${ownerKind}-${slug || "wpp"}`;
}

export function NewConnectionDialog({ open, onOpenChange, weddingId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: wedding } = useGetWedding(weddingId);

  const [step, setStep] = useState<Step>("owner");
  const [ownerKind, setOwnerKind] = useState<WhatsappOwnerKind>("event");
  const [instanceName, setInstanceName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [label, setLabel] = useState("");
  const [createdConnection, setCreatedConnection] =
    useState<WhatsappConnectionCreateResult | null>(null);
  const [instanceNameTouched, setInstanceNameTouched] = useState(false);

  const createMutation = useCreateWhatsappConnection();

  const connectionId = createdConnection?.connection.id ?? 0;
  const statusQuery = useGetWhatsappConnectionStatus(weddingId, connectionId, {
    query: {
      queryKey: getGetWhatsappConnectionStatusQueryKey(weddingId, connectionId),
      enabled: !!connectionId && step === "qr",
      refetchInterval: (q: Query<unknown>) => {
        const data = q.state.data as { status?: string } | undefined;
        if (!data) return 2000;
        return data.status === "connected" ? false : 2000;
      },
    },
  });

  const currentStatus = statusQuery.data?.status;
  const isConnected = currentStatus === "connected";

  useEffect(() => {
    if (!open) {
      setStep("owner");
      setOwnerKind("event");
      setInstanceName("");
      setPhoneNumber("");
      setLabel("");
      setCreatedConnection(null);
      setInstanceNameTouched(false);
    }
  }, [open]);

  const suggestedName = useMemo(
    () =>
      suggestInstanceName(
        weddingId,
        ownerKind,
        wedding?.brideName,
        wedding?.groomName,
      ),
    [weddingId, ownerKind, wedding?.brideName, wedding?.groomName],
  );

  useEffect(() => {
    if (!instanceNameTouched) {
      setInstanceName(suggestedName);
    }
  }, [suggestedName, instanceNameTouched]);

  useEffect(() => {
    if (!label) {
      const owner = OWNER_OPTIONS.find((o) => o.kind === ownerKind);
      setLabel(owner?.title ?? "");
    }
  }, [ownerKind, label]);

  useEffect(() => {
    if (isConnected) {
      void queryClient.invalidateQueries({
        queryKey: getListWhatsappConnectionsQueryKey(weddingId),
      });
    }
  }, [isConnected, queryClient, weddingId]);

  const handleCreate = async () => {
    try {
      const digits = phoneNumber.replace(/\D/g, "");
      const result = await createMutation.mutateAsync({
        weddingId,
        data: {
          provider: "evolution",
          ownerKind,
          label: label.trim() || null,
          phoneNumber: digits || null,
          evolutionInstanceName: instanceName.trim(),
        },
      });
      setCreatedConnection(result);
      setStep("qr");
      void queryClient.invalidateQueries({
        queryKey: getListWhatsappConnectionsQueryKey(weddingId),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        variant: "destructive",
        title: "Falha ao criar instância",
        description: message,
      });
    }
  };

  const qrBase64 = createdConnection?.qrcode?.base64 ?? null;
  const qrPairingCode = createdConnection?.qrcode?.pairingCode ?? null;

  const handleClose = () => {
    if (isConnected) {
      toast({ title: "Conexão estabelecida com sucesso" });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova conexão de WhatsApp</DialogTitle>
          <DialogDescription>
            Crie uma nova instância no Evolution API e leia o QR Code com o celular
            da noiva, do noivo ou do número do evento.
          </DialogDescription>
        </DialogHeader>

        {step === "owner" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">A quem pertence esta conexão?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {OWNER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = ownerKind === opt.kind;
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => setOwnerKind(opt.kind)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mb-2 ${
                        active ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="font-medium text-sm">{opt.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "instance" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rótulo (opcional)</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: WhatsApp da Noiva"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nome da instância</label>
              <Input
                value={instanceName}
                onChange={(e) => {
                  setInstanceName(e.target.value);
                  setInstanceNameTouched(true);
                }}
                placeholder="casamento-123-event-evento"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nome único desta instância dentro do Evolution API. Sem espaços,
                apenas letras, números e hífens.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Número (opcional)</label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="55 11 99999-9999"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe o número no formato internacional (DDI + DDD + número).
                Pode ficar em branco e vincular só pela leitura do QR.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Provedor</label>
              <select
                value="evolution"
                disabled
                className="w-full p-2.5 border rounded-lg bg-background text-sm mt-1"
              >
                <option value="evolution">Evolution API — WHATSAPP-BAILEYS</option>
                <option value="meta_cloud" disabled>
                  WhatsApp Business Cloud — em breve
                </option>
              </select>
            </div>
          </div>
        )}

        {step === "qr" && (
          <div className="space-y-4 text-center">
            {isConnected ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                <p className="text-lg font-medium">Conectado!</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  O número foi pareado com sucesso e a apikey da instância já está
                  salva.
                </p>
              </div>
            ) : qrBase64 ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={
                    qrBase64.startsWith("data:")
                      ? qrBase64
                      : `data:image/png;base64,${qrBase64}`
                  }
                  alt="QR Code do WhatsApp"
                  className="w-64 h-64 border rounded-md bg-white p-2"
                />
                <p className="text-sm text-muted-foreground max-w-sm">
                  Abra o WhatsApp no celular, vá em{" "}
                  <span className="font-medium">Aparelhos conectados</span> e
                  aponte a câmera para este QR Code. A janela fechará sozinha
                  quando conectar.
                </p>
                {qrPairingCode && (
                  <p className="text-xs text-muted-foreground">
                    Código de pareamento alternativo:{" "}
                    <span className="font-mono font-medium">{qrPairingCode}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Aguardando leitura...
                </div>
              </div>
            ) : (
              <div className="py-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "owner" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("instance")}>Continuar</Button>
            </>
          )}
          {step === "instance" && (
            <>
              <Button variant="ghost" onClick={() => setStep("owner")}>
                Voltar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!instanceName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando instância...
                  </>
                ) : (
                  "Gerar QR Code"
                )}
              </Button>
            </>
          )}
          {step === "qr" && (
            <Button onClick={handleClose} variant={isConnected ? "default" : "outline"}>
              {isConnected ? "Concluir" : "Fechar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
