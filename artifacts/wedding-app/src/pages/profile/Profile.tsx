import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiFetchPath } from "@/lib/api-url";

type MeUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function Profile() {
  const { data: user, isLoading } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (body: { name?: string; currentPassword?: string; newPassword?: string }) => {
      const res = await fetch(apiFetchPath("/auth/me"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string } & Partial<MeUser>;
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível salvar");
      }
      return data as MeUser;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/auth/me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Perfil atualizado" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Informe o nome" });
      return;
    }
    const wantsPassword = newPassword.length > 0 || confirmPassword.length > 0;
    if (wantsPassword) {
      if (!currentPassword) {
        toast({ variant: "destructive", title: "Informe a senha atual" });
        return;
      }
      if (newPassword.length < 8) {
        toast({ variant: "destructive", title: "A nova senha deve ter pelo menos 8 caracteres" });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({ variant: "destructive", title: "As senhas novas não coincidem" });
        return;
      }
    }

    const body: { name?: string; currentPassword?: string; newPassword?: string } = {};
    if (trimmed !== user.name) body.name = trimmed;
    if (wantsPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }
    if (body.name === undefined && !wantsPassword) {
      toast({ title: "Nenhuma alteração" });
      return;
    }

    updateMutation.mutate(body);
  };

  if (isLoading || !user) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/">
            <ArrowLeft className="w-5 h-5" />
            <span className="sr-only">Voltar</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-serif text-foreground">Meu perfil</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Dados da conta</CardTitle>
          <CardDescription>Atualize seu nome exibido no app ou altere sua senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium mb-1">
                Nome
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="pt-2 border-t border-border/60 space-y-3">
              <p className="text-sm font-medium text-foreground">Alterar senha (opcional)</p>
              <div>
                <label htmlFor="profile-current" className="block text-sm font-medium mb-1">
                  Senha atual
                </label>
                <Input
                  id="profile-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label htmlFor="profile-new" className="block text-sm font-medium mb-1">
                  Nova senha
                </label>
                <Input
                  id="profile-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="profile-confirm" className="block text-sm font-medium mb-1">
                  Confirmar nova senha
                </label>
                <Input
                  id="profile-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
