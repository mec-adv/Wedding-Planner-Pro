import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetIntegrationSettings, useUpdateIntegrationSettings, useTestWhatsappConnection, useTestAsaasConnection } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetIntegrationSettings(wid);
  const updateMutation = useUpdateIntegrationSettings();
  const testWhatsapp = useTestWhatsappConnection();
  const testAsaas = useTestAsaasConnection();

  const [form, setForm] = useState({
    evolutionApiUrl: "",
    evolutionApiKey: "",
    evolutionInstance: "",
    asaasApiKey: "",
    asaasEnvironment: "sandbox" as "sandbox" | "production",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        evolutionApiUrl: settings.evolutionApiUrl || "",
        evolutionApiKey: settings.evolutionApiKey || "",
        evolutionInstance: settings.evolutionInstance || "",
        asaasApiKey: settings.asaasApiKey || "",
        asaasEnvironment: (settings.asaasEnvironment as "sandbox" | "production") || "sandbox",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        weddingId: wid,
        data: form,
      });
      toast({ title: "Configurações salvas" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    }
  };

  const handleTestWhatsapp = async () => {
    try {
      const result = await testWhatsapp.mutateAsync({ weddingId: wid }) as unknown as { success: boolean; message: string };
      toast({
        title: result.success ? "WhatsApp conectado!" : "Falha na conexão",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch {
      toast({ variant: "destructive", title: "Erro ao testar conexão" });
    }
  };

  const handleTestAsaas = async () => {
    try {
      const result = await testAsaas.mutateAsync({ weddingId: wid }) as unknown as { success: boolean; message: string };
      toast({
        title: result.success ? "Asaas conectado!" : "Falha na conexão",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch {
      toast({ variant: "destructive", title: "Erro ao testar conexão" });
    }
  };

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/4" /><div className="h-64 bg-muted rounded" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Configurações de Integrações</h1>
        <p className="text-muted-foreground mt-1">Configure o WhatsApp e gateway de pagamento.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-green-500/10">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <CardTitle>WhatsApp (Evolution API)</CardTitle>
                <CardDescription>Envie convites e mensagens via WhatsApp</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><label className="text-sm font-medium">URL da API</label><Input value={form.evolutionApiUrl} onChange={e => setForm(f => ({ ...f, evolutionApiUrl: e.target.value }))} placeholder="https://sua-api.com" /></div>
            <div><label className="text-sm font-medium">API Key</label><Input value={form.evolutionApiKey} onChange={e => setForm(f => ({ ...f, evolutionApiKey: e.target.value }))} type="password" /></div>
            <div><label className="text-sm font-medium">Nome da Instância</label><Input value={form.evolutionInstance} onChange={e => setForm(f => ({ ...f, evolutionInstance: e.target.value }))} placeholder="minha-instancia" /></div>
            <Button variant="outline" onClick={handleTestWhatsapp} disabled={testWhatsapp.isPending} className="w-full">
              {testWhatsapp.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...</> : "Testar Conexão"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/10">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Asaas (Pagamentos)</CardTitle>
                <CardDescription>Receba pagamentos via PIX, boleto e cartão</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><label className="text-sm font-medium">API Key</label><Input value={form.asaasApiKey} onChange={e => setForm(f => ({ ...f, asaasApiKey: e.target.value }))} type="password" /></div>
            <div>
              <label className="text-sm font-medium">Ambiente</label>
              <select value={form.asaasEnvironment} onChange={e => setForm(f => ({ ...f, asaasEnvironment: e.target.value as "sandbox" | "production" }))} className="w-full p-2.5 border rounded-lg bg-background text-sm mt-1">
                <option value="sandbox">Sandbox (Teste)</option>
                <option value="production">Produção</option>
              </select>
            </div>
            <Button variant="outline" onClick={handleTestAsaas} disabled={testAsaas.isPending} className="w-full">
              {testAsaas.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...</> : "Testar Conexão"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="px-8">
          {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
