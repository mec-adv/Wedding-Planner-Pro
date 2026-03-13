import { useState } from "react";
import { useParams } from "wouter";
import { useListMessages, useDeleteMessage, useListMessageTemplates, useCreateMessageTemplate, useDeleteMessageTemplate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, FileText, Plus, Trash2, Heart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Messages() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);

  const { data: messages, isLoading: messagesLoading } = useListMessages(wid);
  const { data: templates, isLoading: templatesLoading } = useListMessageTemplates(wid);
  const deleteMessageMutation = useDeleteMessage();
  const createTemplateMutation = useCreateMessageTemplate();
  const deleteTemplateMutation = useDeleteMessageTemplate();

  const handleDeleteMessage = async (id: number) => {
    if (!confirm("Remover esta mensagem?")) return;
    try {
      await deleteMessageMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/messages`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createTemplateMutation.mutateAsync({
        weddingId: wid,
        data: {
          name: fd.get("name") as string,
          content: fd.get("content") as string,
          category: "custom" as any,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/message-templates`] });
      setIsTemplateOpen(false);
      toast({ title: "Modelo criado" });
    } catch {
      toast({ variant: "destructive", title: "Erro ao criar modelo" });
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Remover este modelo?")) return;
    try {
      await deleteTemplateMutation.mutateAsync({ weddingId: wid, id });
      queryClient.invalidateQueries({ queryKey: [`/api/weddings/${wid}/message-templates`] });
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Mensagens e Modelos</h1>
        <p className="text-muted-foreground mt-1">Mensagens dos convidados e modelos de WhatsApp.</p>
      </div>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages" className="gap-2"><MessageCircle className="w-4 h-4" /> Mensagens</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="w-4 h-4" /> Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {messagesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>)
            ) : messages?.length === 0 ? (
              <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhuma mensagem recebida.</CardContent></Card>
            ) : messages?.map(msg => (
              <Card key={msg.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{msg.senderName}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMessage(msg.id)} className="text-destructive hover:bg-destructive/10 -mt-1 -mr-2">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 italic">"{msg.content}"</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(msg.createdAt).toLocaleDateString("pt-BR")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <div className="flex justify-end mb-4">
            <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full shadow-md"><Plus className="w-4 h-4 mr-2" /> Novo Modelo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif text-xl">Criar Modelo de Mensagem</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateTemplate} className="space-y-4">
                  <div><label className="text-sm font-medium">Nome do Modelo</label><Input name="name" required /></div>
                  <div>
                    <label className="text-sm font-medium">Conteúdo</label>
                    <textarea name="content" required className="w-full p-3 border rounded-lg min-h-[120px] text-sm bg-background" placeholder="Use {nome} para personalizar..." />
                  </div>
                  <Button type="submit" className="w-full" disabled={createTemplateMutation.isPending}>
                    {createTemplateMutation.isPending ? "Salvando..." : "Salvar Modelo"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {templatesLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>)
            ) : templates?.length === 0 ? (
              <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhum modelo criado.</CardContent></Card>
            ) : templates?.map(tpl => (
              <Card key={tpl.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{tpl.name}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(tpl.id)} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tpl.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
