import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

// Layout & Auth
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";

// Pages
import SelectWedding from "@/pages/weddings/SelectWedding";
import Dashboard from "@/pages/dashboard/Dashboard";
import Guests from "@/pages/guests/Guests";
import Gifts from "@/pages/gifts/Gifts";
import Extract from "@/pages/gifts/Extract";
import Tasks from "@/pages/tasks/Tasks";
import Budget from "@/pages/budget/Budget";
import Schedule from "@/pages/schedule/Schedule";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Monkey-patch fetch to include auth token for @workspace/api-client-react
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    if (args[1]) {
      args[1].headers = { ...args[1].headers, Authorization: `Bearer ${token}` };
    } else {
      args[1] = { headers: { Authorization: `Bearer ${token}` } };
    }
  }
  return originalFetch(...args);
};

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-background"><div className="animate-pulse font-serif text-2xl text-primary">Carregando...</div></div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  
  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected Routes */}
      <Route path="/" component={() => <ProtectedRoute component={SelectWedding} />} />
      <Route path="/weddings/:weddingId/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/weddings/:weddingId/guests" component={() => <ProtectedRoute component={Guests} />} />
      <Route path="/weddings/:weddingId/gifts" component={() => <ProtectedRoute component={Gifts} />} />
      <Route path="/weddings/:weddingId/extract" component={() => <ProtectedRoute component={Extract} />} />
      <Route path="/weddings/:weddingId/tasks" component={() => <ProtectedRoute component={Tasks} />} />
      <Route path="/weddings/:weddingId/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/weddings/:weddingId/schedule" component={() => <ProtectedRoute component={Schedule} />} />
      
      {/* Fallback for not fully implemented pages just to not break routing */}
      <Route path="/weddings/:weddingId/seating" component={() => <ProtectedRoute component={() => <div className="p-8 text-center text-muted-foreground">Mapa de Assentos em construção</div>} />} />
      <Route path="/weddings/:weddingId/vendors" component={() => <ProtectedRoute component={() => <div className="p-8 text-center text-muted-foreground">Fornecedores em construção</div>} />} />
      <Route path="/weddings/:weddingId/coordinators" component={() => <ProtectedRoute component={() => <div className="p-8 text-center text-muted-foreground">Equipe em construção</div>} />} />
      <Route path="/weddings/:weddingId/messages" component={() => <ProtectedRoute component={() => <div className="p-8 text-center text-muted-foreground">Mensagens em construção</div>} />} />
      <Route path="/weddings/:weddingId/templates" component={() => <ProtectedRoute component={() => <div className="p-8 text-center text-muted-foreground">Modelos em construção</div>} />} />
      <Route path="/weddings/:weddingId/settings" component={() => <ProtectedRoute component={() => <div className="p-8 text-center text-muted-foreground">Configurações em construção</div>} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
