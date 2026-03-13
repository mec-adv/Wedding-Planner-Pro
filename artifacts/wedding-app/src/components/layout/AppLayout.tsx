import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Heart, LayoutDashboard, Users, Gift, Receipt, 
  CheckSquare, Store, UserCircle, Calendar, 
  DollarSign, Map, MessageSquare, Settings,
  LogOut, Menu, X, ShoppingCart
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { useListWeddings } from "@workspace/api-client-react";

interface AppLayoutProps {
  children: ReactNode;
}

type UserRole = "admin" | "planner" | "coordinator" | "couple" | "guest";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles: UserRole[];
}

function getNavItems(wId: number): NavItem[] {
  return [
    { href: `/weddings/${wId}/dashboard`, label: "Dashboard", icon: LayoutDashboard, allowedRoles: ["admin", "planner", "coordinator", "couple", "guest"] },
    { href: `/weddings/${wId}/guests`, label: "Convidados", icon: Users, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/gifts`, label: "Presentes", icon: Gift, allowedRoles: ["admin", "planner", "coordinator", "couple"] },
    { href: `/weddings/${wId}/extract`, label: "Extrato", icon: Receipt, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/tasks`, label: "Tarefas", icon: CheckSquare, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/budget`, label: "Orçamento", icon: DollarSign, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/schedule`, label: "Programação", icon: Calendar, allowedRoles: ["admin", "planner", "coordinator", "couple"] },
    { href: `/weddings/${wId}/seating`, label: "Assentos", icon: Map, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/vendors`, label: "Fornecedores", icon: Store, allowedRoles: ["admin", "planner", "coordinator"] },
    { href: `/weddings/${wId}/coordinators`, label: "Equipe", icon: UserCircle, allowedRoles: ["admin", "planner"] },
    { href: `/weddings/${wId}/messages`, label: "Mensagens", icon: MessageSquare, allowedRoles: ["admin", "planner", "coordinator", "couple", "guest"] },
    { href: `/weddings/${wId}/checkout`, label: "Checkout", icon: ShoppingCart, allowedRoles: ["admin", "planner", "coordinator", "couple", "guest"] },
    { href: `/weddings/${wId}/settings`, label: "Configurações", icon: Settings, allowedRoles: ["admin", "planner"] },
  ];
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const { data: weddings } = useListWeddings({
    query: { queryKey: ['/api/weddings'], enabled: !!user }
  });
  const currentWedding = weddings?.[0];
  const wId = currentWedding?.id || 1;

  const userRole = (user?.role || "guest") as UserRole;
  const isOwner = currentWedding && user ? Number(currentWedding.createdById) === user.id : false;

  const allNavItems = getNavItems(wId);
  const navItems = allNavItems.filter(item => {
    if (userRole === "admin") return true;
    if (isOwner) return true;
    return item.allowedRoles.includes(userRole);
  });

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2 text-primary">
          <Heart className="w-6 h-6 fill-current" />
          <span className="font-serif font-semibold text-lg">Casamento360</span>
        </div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-foreground">
          {isMobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3 text-primary border-b border-border/50">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-xl tracking-tight leading-none text-foreground">Casamento360</h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {userRole === "admin" ? "Administrador" :
               userRole === "planner" || isOwner ? "Painel da Cerimonialista" :
               userRole === "coordinator" ? "Coordenação" :
               userRole === "couple" ? "Noivos" : "Convidado"}
            </p>
          </div>
        </div>
        
        {currentWedding && (
          <div className="px-6 py-4 bg-secondary/30 border-b border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Casamento Atual</p>
            <p className="font-serif font-medium text-foreground truncate">{currentWedding.title}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
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
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </div>
  );
}
