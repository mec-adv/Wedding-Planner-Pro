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
  useListWhatsappConnections,
  useDeleteWhatsappConnection,
  useLogoutWhatsappConnection,
  getListGuestGroupsQueryKey,
  getListWhatsappConnectionsQueryKey,
  ApiError,
  type WhatsappConnection,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  CreditCard,
  Loader2,
  Users,
  Pencil,
  Trash2,
  Check,
  X,
  ShoppingBag,
  Tag,
  LayoutTemplate,
  Plus,
  Heart,
  User,
  CalendarDays,
  Power,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminShopSettings, updateAdminShopSettings } from "@/lib/shop-admin-api";
import { GiftCategoriesPanel } from "@/pages/gifts/GiftCategories";
import { PublicInviteTemplatesPanel } from "@/pages/public/PublicInviteTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewConnectionDialog } from "@/pages/settings/whatsapp/NewConnectionDialog";

const SETTINGS_TABS = ["whatsapp", "financeiro", "grupos", "categorias", "paginas"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function readTabFromUrl(): SettingsTab {
  if (typeof window === "undefined") return "whatsapp";
  const t = new URLSearchParams(window.location.search).get("tab");
  return SETTINGS_TABS.includes(t as SettingsTab) ? (t as SettingsTab) : "whatsapp";
}

export default function Settings() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => readTabFromUrl());

  useEffect(() => {
    setActiveTab(readTabFromUrl());
  }, [wid]);

  const onTabChange = (v: string) => {
    const next = v as SettingsTab;
    setActiveTab(next);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", next);
    window.history.replaceState({}, "", `${u.pathname}?${u.searchParams.toString()}`);
  };

  const { data: settings, isLoading } = useGetIntegrationSettings(wid);
  const { data: guestGroups, isLoading: isLoadingGroups } = useListGuestGroups(wid);
  const { data: whatsappConnections, isLoading: isLoadingConnections } =
    useListWhatsappConnections(wid);
  const updateMutation = useUpdateIntegrationSettings();
  const testWhatsapp = useTestWhatsappConnection();
  const testAsaas = useTestAsaasConnection();
  const createGuestGroup = useCreateGuestGroup();
  const updateGuestGroup = useUpdateGuestGroup();
  const deleteGuestGroup = useDeleteGuestGroup();
  const deleteWhatsappConnection = useDeleteWhatsappConnection();
  const logoutWhatsappConnection = useLogoutWhatsappConnection();
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);

  const { data: shopSettings } = useQuery({
    queryKey: ["admin-shop-settings", wid],
    queryFn: () => fetchAdminShopSettings(wid),
    enabled: !!wid,
  });

  const updateShopMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateAdminShopSettings>[1]) => updateAdminShopSettings(wid, data),
    onSuccess: () => {
      toast({ title: "Configurações da loja salvas" });
      void queryClient.invalidateQueries({ queryKey: ["admin-shop-settings", wid] });
    },
    onError: () => toast({ variant: "destructive", title: "Erro ao salvar" }),
  });

  const [shopForm, setShopForm] = useState({
    showProgressBar: false,
    progressGoal: "",
    thankYouMessage: "",
  });

  useEffect(() => {
    if (shopSettings) {
      setShopForm({
        showProgressBar: shopSettings.showProgressBar ?? false,
        progressGoal: shopSettings.progressGoal != null ? String(shopSettings.progressGoal) : "",
        thankYouMessage: shopSettings.thankYouMessage ?? "",
      });
    }
  }, [shopSettings]);

  const handleSaveShop = () => {
    updateShopMutation.mutate({
      showProgressBar: shopForm.showProgressBar,
      progressGoal: shopForm.progressGoal ? parseFloat(shopForm.progressGoal) : null,
      thankYouMessage: shopForm.thankYouMessage.trim() || null,
    });
  };

  const [form, setForm] = useState({
    evolutionApiUrl: "",
    evolutionApiKey: "",
    asaasApiKey: "",
    asaasEnvironment: "sandbox" as "sandbox" | "production",
    asaasWebhookToken: "",
    asaasPublicKey: "",
    activePaymentGateway: "asaas" as string,
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
        asaasApiKey: settings.asaasApiKey || "",
        asaasEnvironment: (settings.asaasEnvironment as "sandbox" | "production") || "sandbox",
        asaasWebhookToken: settings.asaasWebhookToken as string || "",
        asaasPublicKey: settings.asaasPublicKey || "",
        activePaymentGateway: settings.activePaymentGateway || "asaas",
      });
    }
  }, [settings]);

  const handleSaveIntegrations = async () => {
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
      const result = (await testWhatsapp.mutateAsync({ weddingId: wid })) as unknown as {
        success: boolean;
        message: string;
      };
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
      const result = (await testAsaas.mutateAsync({ weddingId: wid })) as unknown as {
        success: boolean;
        message: string;
      };
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

  const reloadWhatsappConnections = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListWhatsappConnectionsQueryKey(wid),
    });
  };

  const handleDeleteWhatsappConnection = async (conn: WhatsappConnection) => {
    const instanceLabel = conn.label || conn.evolutionInstanceName || `#${conn.id}`;
    if (!confirm(`Excluir a conexão "${instanceLabel}"?`)) return;
    try {
      await deleteWhatsappConnection.mutateAsync({ weddingId: wid, id: conn.id });
      await reloadWhatsappConnections();
      toast({ title: "Conexão removida" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir conexão",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleLogoutWhatsappConnection = async (conn: WhatsappConnection) => {
    try {
      await logoutWhatsappConnection.mutateAsync({ weddingId: wid, id: conn.id });
      await reloadWhatsappConnections();
      toast({ title: "Conexão desconectada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao desconectar",
        description: err instanceof Error ? err.message : undefined,
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

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Integrações, grupos de convidados, categorias de presentes e páginas públicas do casamento e da loja.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex h-auto w-full min-h-10 flex-wrap items-stretch justify-start gap-1 bg-muted/50 p-1 sm:flex-nowrap sm:overflow-x-auto">
          <TabsTrigger value="whatsapp" className="gap-1.5 shrink-0 px-3 py-2">
            <MessageCircle className="w-4 h-4 shrink-0" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-1.5 shrink-0 px-3 py-2">
            <CreditCard className="w-4 h-4 shrink-0" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1.5 shrink-0 px-3 py-2">
            <Users className="w-4 h-4 shrink-0" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-1.5 shrink-0 px-3 py-2">
            <Tag className="w-4 h-4 shrink-0" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="paginas" className="gap-1.5 shrink-0 px-3 py-2">
            <LayoutTemplate className="w-4 h-4 shrink-0" />
            Páginas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-green-500/10">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Servidor Evolution API</CardTitle>
                  <CardDescription>
                    Credenciais essenciais do servidor. A partir delas você pode criar quantas instâncias forem necessárias (uma por noivo, noiva e/ou para o evento).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Base URL</label>
                <Input
                  value={form.evolutionApiUrl}
                  onChange={(e) => setForm((f) => ({ ...f, evolutionApiUrl: e.target.value }))}
                  placeholder="https://sua-evolution-api.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">API Key (admin do servidor)</label>
                <Input
                  value={form.evolutionApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, evolutionApiKey: e.target.value }))}
                  type="password"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usada apenas para criar novas instâncias. As chaves específicas de cada instância são guardadas separadamente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSaveIntegrations()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
                    </>
                  ) : (
                    "Salvar servidor"
                  )}
                </Button>
                <Button variant="outline" onClick={handleTestWhatsapp} disabled={testWhatsapp.isPending}>
                  {testWhatsapp.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando…
                    </>
                  ) : (
                    "Testar conexão padrão"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10">
                    <MessageCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Conexões de WhatsApp</CardTitle>
                    <CardDescription>
                      Você pode cadastrar um número para a noiva, um para o noivo e um para o evento. Em breve, também suportaremos a API oficial do WhatsApp Business.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsConnectionDialogOpen(true)}
                  disabled={!settings?.evolutionApiUrl || !settings?.evolutionApiKey}
                  title={
                    !settings?.evolutionApiUrl || !settings?.evolutionApiKey
                      ? "Salve primeiro a Base URL e a API Key do servidor"
                      : "Adicionar nova conexão"
                  }
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingConnections ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Carregando conexões...
                </div>
              ) : !whatsappConnections?.length ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma conexão cadastrada ainda. Clique em "Adicionar" para criar a
                  primeira instância.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {whatsappConnections.map((conn) => (
                    <WhatsappConnectionRow
                      key={conn.id}
                      conn={conn}
                      onDelete={handleDeleteWhatsappConnection}
                      onLogout={handleLogoutWhatsappConnection}
                      busy={
                        deleteWhatsappConnection.isPending ||
                        logoutWhatsappConnection.isPending
                      }
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <NewConnectionDialog
            open={isConnectionDialogOpen}
            onOpenChange={setIsConnectionDialogOpen}
            weddingId={wid}
          />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-500/10">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Financeiro</CardTitle>
                  <CardDescription>
                    Integração com Asaas (PIX, boleto e cartão). Outros gateways poderão ser adicionados aqui no futuro.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Gateway de Pagamento</label>
                <select
                  value={form.activePaymentGateway}
                  onChange={(e) => setForm((f) => ({ ...f, activePaymentGateway: e.target.value }))}
                  className="w-full p-2.5 border rounded-lg bg-background text-sm mt-1"
                >
                  <option value="asaas">Asaas</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Apenas um gateway por casamento. Novos gateways poderão ser adicionados aqui no futuro.</p>
              </div>
              <div>
                <label className="text-sm font-medium">API Key (secreta)</label>
                <Input
                  value={form.asaasApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, asaasApiKey: e.target.value }))}
                  type="password"
                  placeholder="$aact_…"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Chave privada da sua conta Asaas. Nunca compartilhe.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Chave Pública (para tokenização do cartão)</label>
                <Input
                  value={form.asaasPublicKey}
                  onChange={(e) => setForm((f) => ({ ...f, asaasPublicKey: e.target.value }))}
                  placeholder="pub_…"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Usada pelo Asaas.js no browser para tokenizar dados do cartão — segura para expor ao frontend.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Token do Webhook</label>
                <Input
                  value={form.asaasWebhookToken}
                  onChange={(e) => setForm((f) => ({ ...f, asaasWebhookToken: e.target.value }))}
                  type="password"
                  placeholder="Token de autenticação do webhook Asaas"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Configure este token no painel Asaas → Configurações → Webhooks. URL do webhook:{" "}
                  <code className="bg-muted px-1 rounded text-xs">/api/webhooks/asaas</code>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Ambiente</label>
                <select
                  value={form.asaasEnvironment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, asaasEnvironment: e.target.value as "sandbox" | "production" }))
                  }
                  className="w-full p-2.5 border rounded-lg bg-background text-sm mt-1"
                >
                  <option value="sandbox">Sandbox (testes)</option>
                  <option value="production">Produção</option>
                </select>
              </div>
              <Button variant="outline" onClick={handleTestAsaas} disabled={testAsaas.isPending} className="w-full sm:w-auto">
                {testAsaas.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando…
                  </>
                ) : (
                  "Testar conexão"
                )}
              </Button>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => void handleSaveIntegrations()} disabled={updateMutation.isPending} className="px-8">
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar integrações"
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="grupos" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-violet-500/10">
                  <Users className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <CardTitle>Grupos de convidados</CardTitle>
                  <CardDescription>Visualize, inclua, edite e exclua grupos usados no campo Grupo dos convidados.</CardDescription>
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
                <Button type="button" onClick={handleCreateGroup} disabled={createGuestGroup.isPending} className="sm:w-auto">
                  {createGuestGroup.isPending ? "Incluindo…" : "Incluir grupo"}
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
                          Carregando grupos…
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
                                  <Button type="button" variant="ghost" size="icon" title="Cancelar" onClick={cancelEditGroup}>
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
        </TabsContent>

        <TabsContent value="categorias" className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-serif text-foreground">Categorias de presentes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Organize os presentes em categorias para facilitar a navegação na loja.
            </p>
          </div>
          <GiftCategoriesPanel weddingId={wid} embedded />
        </TabsContent>

        <TabsContent value="paginas" className="mt-6 space-y-10">
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-serif text-foreground flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Loja de presentes (página pública)
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Opções exibidas na vitrine e no fluxo de compra da lista de presentes.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aparência e mensagens da loja</CardTitle>
                <CardDescription>Barra de progresso e mensagem de agradecimento após a compra.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showProgressBar"
                    checked={shopForm.showProgressBar}
                    onChange={(e) => setShopForm((prev) => ({ ...prev, showProgressBar: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="showProgressBar" className="text-sm font-medium">
                    Exibir barra de progresso na loja
                  </label>
                </div>
                {shopForm.showProgressBar && (
                  <div>
                    <label className="text-sm font-medium block mb-1">Meta (R$)</label>
                    <Input
                      type="number"
                      min={0}
                      step="100"
                      value={shopForm.progressGoal}
                      onChange={(e) => setShopForm((prev) => ({ ...prev, progressGoal: e.target.value }))}
                      placeholder="Ex.: 5000"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium block mb-1">Mensagem de agradecimento dos noivos</label>
                  <textarea
                    className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={3}
                    value={shopForm.thankYouMessage}
                    onChange={(e) => setShopForm((prev) => ({ ...prev, thankYouMessage: e.target.value }))}
                    placeholder="Uma mensagem especial para aparecer na notificação de confirmação de compra…"
                    maxLength={500}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveShop} disabled={updateShopMutation.isPending} size="sm">
                    {updateShopMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
                      </>
                    ) : (
                      "Salvar configurações da loja"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4 border-t border-border pt-10">
            <PublicInviteTemplatesPanel weddingId={wid} embedded />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const OWNER_META: Record<
  "bride" | "groom" | "event",
  { label: string; icon: typeof Heart }
> = {
  bride: { label: "Noiva", icon: Heart },
  groom: { label: "Noivo", icon: User },
  event: { label: "Evento", icon: CalendarDays },
};

const STATUS_META: Record<
  "pending" | "qr" | "connected" | "disconnected" | "error",
  { label: string; className: string }
> = {
  pending: { label: "Aguardando", className: "text-muted-foreground" },
  qr: { label: "Escaneie o QR", className: "text-amber-600" },
  connected: { label: "Conectado", className: "text-emerald-600" },
  disconnected: { label: "Desconectado", className: "text-muted-foreground" },
  error: { label: "Erro", className: "text-destructive" },
};

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  const country = digits.slice(0, 2);
  const area = digits.slice(2, 4);
  const last4 = digits.slice(-4);
  return `+${country} (${area}) ••••-${last4}`;
}

interface WhatsappConnectionRowProps {
  conn: WhatsappConnection;
  onDelete: (conn: WhatsappConnection) => void;
  onLogout: (conn: WhatsappConnection) => void;
  busy: boolean;
}

function WhatsappConnectionRow({
  conn,
  onDelete,
  onLogout,
  busy,
}: WhatsappConnectionRowProps) {
  const owner =
    OWNER_META[conn.ownerKind as keyof typeof OWNER_META] ?? OWNER_META.event;
  const status =
    STATUS_META[conn.status as keyof typeof STATUS_META] ?? STATUS_META.pending;
  const OwnerIcon = owner.icon;
  const providerLabel =
    conn.provider === "meta_cloud"
      ? "WhatsApp Business Cloud"
      : "Evolution / WHATSAPP-BAILEYS";

  return (
    <li className="py-3 flex flex-wrap items-center gap-3">
      <div className="p-2 rounded-xl bg-emerald-500/10">
        <OwnerIcon className="w-5 h-5 text-emerald-700" />
      </div>
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-2 text-sm font-medium">
          {conn.label || owner.label}
          <span className="text-xs font-normal text-muted-foreground">
            · {owner.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {conn.evolutionInstanceName || "—"} · {maskPhone(conn.phoneNumber)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{providerLabel}</div>
      </div>
      <div className={`flex items-center gap-1.5 text-sm ${status.className}`}>
        <CircleDot className="w-3.5 h-3.5" />
        {status.label}
      </div>
      <div className="flex items-center gap-1">
        {conn.status === "connected" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Desconectar"
            disabled={busy}
            onClick={() => onLogout(conn)}
          >
            <Power className="w-4 h-4 text-amber-700" />
          </Button>
        )}
        {conn.status !== "connected" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Reconectar (em breve)"
            disabled
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Excluir conexão"
          disabled={busy}
          onClick={() => onDelete(conn)}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
