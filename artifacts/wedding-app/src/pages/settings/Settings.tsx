import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  useGetIntegrationSettings,
  useUpdateIntegrationSettings,
  useTestWhatsappConnection,
  useTestAsaasConnection,
  useListGuestGroups,
  useCreateGuestGroup,
  useUpdateGuestGroup,
  useDeleteGuestGroup,
  getListGuestGroupsQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, CreditCard, Loader2, Users, Pencil, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetIntegrationSettings(wid);
  const { data: guestGroups, isLoading: isLoadingGroups } = useListGuestGroups(wid);
  const updateMutation = useUpdateIntegrationSettings();
  const testWhatsapp = useTestWhatsappConnection();
  const testAsaas = useTestAsaasConnection();
  const createGuestGroup = useCreateGuestGroup();
  const updateGuestGroup = useUpdateGuestGroup();
  const deleteGuestGroup = useDeleteGuestGroup();

  const [form, setForm] = useState({
    evolutionApiUrl: "",
    evolutionApiKey: "",
    evolutionInstance: "",
    asaasApiKey: "",
    asaasEnvironment: "sandbox" as "sandbox" | "production",
  });
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const getApiErrorMessage = (err: unknown): string | null => {
    if (!(err instanceof ApiError)) return null;
    const data = err.data as { error?: string; message?: string } | null;
    return data?.error ?? data?.message ?? null;
  };

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

  const reloadGuestGroups = async () => {
    await queryClient.invalidateQueries({ queryKey: getListGuestGroupsQueryKey(wid) });
    await queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/guests`] });
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Informe o nome do grupo." });
      return;
    }
    try {
      await createGuestGroup.mutateAsync({
        weddingId: wid,
        data: { name },
      });
      setNewGroupName("");
      await reloadGuestGroups();
      toast({ title: "Grupo criado" });
    } catch (err) {
      const message = getApiErrorMessage(err);
      toast({
        variant: "destructive",
        title:
          message?.includes("Já existe um grupo") || message?.includes("duplicate")
            ? "Já existe um grupo com o mesmo nome."
            : "Erro ao criar grupo",
        description:
          message?.includes("Já existe um grupo") || message?.includes("duplicate")
            ? undefined
            : message ?? undefined,
      });
    }
  };

  const startEditGroup = (id: number, name: string) => {
    setEditingGroupId(id);
    setEditingGroupName(name);
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  const handleSaveGroup = async () => {
    if (editingGroupId == null) return;
    const name = editingGroupName.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Informe o nome do grupo." });
      return;
    }
    try {
      await updateGuestGroup.mutateAsync({
        weddingId: wid,
        id: editingGroupId,
        data: { name },
      });
      cancelEditGroup();
      await reloadGuestGroups();
      toast({ title: "Grupo atualizado" });
    } catch (err) {
      const message = getApiErrorMessage(err);
      toast({
        variant: "destructive",
        title:
          message?.includes("Já existe um grupo") || message?.includes("duplicate")
            ? "Grupo já existe."
            : "Erro ao atualizar grupo",
        description:
          message?.includes("Já existe um grupo") || message?.includes("duplicate")
            ? "Use outro nome para continuar."
            : message ?? undefined,
      });
    }
  };

  const handleDeleteGroup = async (id: number, name: string) => {
    if (!confirm(`Excluir o grupo "${name}"?`)) return;
    try {
      await deleteGuestGroup.mutateAsync({ weddingId: wid, id });
      await reloadGuestGroups();
      toast({ title: "Grupo removido" });
      if (editingGroupId === id) cancelEditGroup();
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível excluir",
        description: "Se houver convidados vinculados, troque o grupo deles antes de excluir.",
      });
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-violet-500/10">
              <Users className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <CardTitle>Grupos de convidados</CardTitle>
              <CardDescription>Visualize, inclua, edite e exclua grupos usados no campo Grupo.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ex.: Família da noiva"
            />
            <Button
              type="button"
              onClick={handleCreateGroup}
              disabled={createGuestGroup.isPending}
              className="sm:w-auto"
            >
              {createGuestGroup.isPending ? "Incluindo..." : "Incluir grupo"}
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nome</th>
                  <th className="text-right px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingGroups ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">
                      Carregando grupos...
                    </td>
                  </tr>
                ) : !guestGroups?.length ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">
                      Nenhum grupo cadastrado.
                    </td>
                  </tr>
                ) : (
                  guestGroups.map((group) => (
                    <tr key={group.id} className="border-t border-border/50">
                      <td className="px-4 py-3">
                        {editingGroupId === group.id ? (
                          <Input
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{group.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {editingGroupId === group.id ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Salvar"
                                onClick={handleSaveGroup}
                                disabled={updateGuestGroup.isPending}
                              >
                                <Check className="w-4 h-4 text-emerald-600" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Cancelar"
                                onClick={cancelEditGroup}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Editar grupo"
                                onClick={() => startEditGroup(group.id, group.name)}
                              >
                                <Pencil className="w-4 h-4 text-amber-700" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Excluir grupo"
                                onClick={() => void handleDeleteGroup(group.id, group.name)}
                                disabled={deleteGuestGroup.isPending}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="px-8">
          {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
