import { ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Heart,
  LayoutDashboard,
  Users,
  Gift,
  Receipt,
  CheckSquare,
  Store,
  UserCircle,
  Calendar,
  DollarSign,
  Map,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Home,
  PencilLine,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useListWeddings } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: ReactNode;
}

type UserRole = "admin" | "planner" | "coordinator" | "couple" | "guest";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  planner: "Cerimonialista",
  coordinator: "Coordenador(a)",
  couple: "Casal",
  guest: "Convidado(a)",
};

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles: UserRole[];
}

function getNavItems(wId: number): NavItem[] {
  return [
    { href: `/weddings/${wId}/dashboard`, label: "Dashboard", icon: LayoutDashboard, allowedRoles: ["admin", "planner", "coordinator", "couple", "guest"] },
    { href: `/weddings/${wId}/edit`, label: "Dados do casamento", icon: PencilLine, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/guests`, label: "Convidados", icon: Users, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/gifts`, label: "Presentes", icon: Gift, allowedRoles: ["admin", "planner", "coordinator", "couple"] },
    { href: `/weddings/${wId}/orders`, label: "Pedidos da Loja", icon: ShoppingCart, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/mural`, label: "Mural de Mensagens", icon: MessageSquare, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/extract`, label: "Extrato", icon: Receipt, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/tasks`, label: "Tarefas", icon: CheckSquare, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/budget`, label: "Orçamento", icon: DollarSign, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/schedule`, label: "Programação", icon: Calendar, allowedRoles: ["admin", "planner", "coordinator", "couple"] },
    { href: `/weddings/${wId}/seating`, label: "Assentos", icon: Map, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/vendors`, label: "Fornecedores", icon: Store, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/coordinators`, label: "Equipe", icon: UserCircle, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/messages`, label: "Mensagens", icon: MessageSquare, allowedRoles: ["admin", "planner", "coordinator", "couple", "guest"] },
    { href: `/weddings/${wId}/settings`, label: "Configurações", icon: Settings, allowedRoles: ["admin", "planner"] },
  ];
}

function AccountMenu({
  triggerClassName,
  onAfterSelect,
}: {
  triggerClassName: string;
  onAfterSelect?: () => void;
}) {
  const { logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClassName} aria-label="Menu da conta">
          <Heart className="w-5 h-5 fill-current" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-52">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile" onClick={() => onAfterSelect?.()}>
            <UserCircle className="mr-2 h-4 w-4" />
            Editar perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => {
            onAfterSelect?.();
            void logout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { data: weddings, isFetched } = useListWeddings({
    query: { queryKey: ["/api/weddings"], enabled: !!user },
  });

  const weddingIdFromPath = (() => {
    const match = location.match(/^\/weddings\/(\d+)(?:\/|$)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  })();

  const inWeddingContext = weddingIdFromPath != null;
  const wId = weddingIdFromPath;
  const currentWedding = wId ? weddings?.find((w) => w.id === wId) ?? null : null;

  const userRole = (user?.role || "guest") as UserRole;
  const isOwner = currentWedding && user ? Number(currentWedding.createdById) === user.id : false;

  const allNavItems = inWeddingContext && wId ? getNavItems(wId) : [];
  const navItems = allNavItems.filter((item) => {
    if (userRole === "admin") return true;
    if (isOwner) return true;
    return item.allowedRoles.includes(userRole);
  });

  if (!user) return <>{children}</>;

  if (isFetched && weddingIdFromPath) {
    if (!weddings || weddings.length === 0) {
      return <Redirect to="/" />;
    }
    if (!weddings.some((w) => w.id === weddingIdFromPath)) {
      return <Redirect to={`/weddings/${weddings[0].id}/dashboard`} />;
    }
  }

  const onHome = location === "/" || location === "";

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <AccountMenu
            triggerClassName="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/15 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onAfterSelect={() => setIsMobileOpen(false)}
          />
          <span className="font-serif font-semibold text-lg text-foreground truncate">Casamento360</span>
        </div>
        <button type="button" onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-foreground">
          {isMobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <AccountMenu
            triggerClassName="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/15 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onAfterSelect={() => setIsMobileOpen(false)}
          />
          <div className="min-w-0">
            <h1 className="font-serif font-bold text-xl tracking-tight leading-none text-foreground">Casamento360</h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {isOwner ? "Painel da Cerimonialista" : ROLE_LABELS[userRole]}
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border/50">
          <Link
            href="/"
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "flex items-center gap-2 text-sm font-medium rounded-lg px-2 py-2 transition-colors",
              onHome ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            <Home className="w-4 h-4" />
            Meus casamentos
          </Link>
        </div>

        {wId && currentWedding && (
          <div className="px-6 py-3 bg-secondary/30 border-b border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Casamento ativo</p>
            <p className="font-serif font-medium text-foreground truncate">{currentWedding.title}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {inWeddingContext &&
            navItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                    isActive
                      ? "text-primary bg-primary/10 shadow-sm shadow-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          {inWeddingContext && navItems.length === 0 && (
            <p className="text-xs text-muted-foreground px-2">Sem itens de menu para o seu perfil neste casamento.</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          role="presentation"
        />
      )}
    </div>
  );
}
