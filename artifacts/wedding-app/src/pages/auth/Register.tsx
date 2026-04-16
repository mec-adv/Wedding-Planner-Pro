import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getSpaBaseHref } from "@/lib/api-url";

const registerSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  role: z.enum(["admin", "planner", "coordinator", "couple", "guest"]).default("planner")
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser, isRegistering } = useAuth();
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "planner" }
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({ data });
      window.location.href = getSpaBaseHref();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao registrar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao criar sua conta."
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block relative w-0 flex-1">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
          alt="Wedding background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-background/20 mix-blend-multiply" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-background">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2 text-primary mb-8">
            <Heart className="w-8 h-8 fill-current" />
            <span className="font-serif font-bold text-2xl tracking-tight">Casamento360</span>
          </div>

          <h2 className="mt-6 text-3xl font-serif font-medium text-foreground tracking-tight">
            Crie sua conta
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Comece a organizar casamentos inesquecíveis
          </p>

          <div className="mt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Nome Completo
                </label>
                <Input
                  {...register("name")}
                  placeholder="Seu nome"
                />
                {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  E-mail
                </label>
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="seu@email.com"
                />
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Senha
                </label>
                <Input
                  type="password"
                  {...register("password")}
                  placeholder="••••••••"
                />
                {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full mt-2" disabled={isRegistering}>
                {isRegistering ? "Criando..." : "Criar Conta"}
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
