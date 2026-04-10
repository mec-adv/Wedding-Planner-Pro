import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";

import SelectWedding from "@/pages/weddings/SelectWedding";
import EditWedding from "@/pages/weddings/EditWedding";
import Dashboard from "@/pages/dashboard/Dashboard";
import Guests from "@/pages/guests/Guests";
import Gifts from "@/pages/gifts/Gifts";
import Extract from "@/pages/gifts/Extract";
import Tasks from "@/pages/tasks/Tasks";
import Budget from "@/pages/budget/Budget";
import Schedule from "@/pages/schedule/Schedule";
import Vendors from "@/pages/vendors/Vendors";
import Coordinators from "@/pages/coordinators/Coordinators";
import Messages from "@/pages/messages/Messages";
import Settings from "@/pages/settings/Settings";
import Seating from "@/pages/seating/Seating";
import Checkout from "@/pages/checkout/Checkout";
import PublicInvite from "@/pages/public/PublicInvite";
import PublicInviteTemplates from "@/pages/public/PublicInviteTemplates";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

/**
 * Intercepta todas as chamadas fetch para incluir `credentials: "include"`,
 * garantindo que o cookie httpOnly de autenticação seja enviado automaticamente
 * em todas as requisições à API — sem expor o token ao JavaScript.
 */
const originalFetch = window.fetch;
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const [input, init] = args;
  return originalFetch(input, { credentials: "include", ...init });
};

function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<Record<string, unknown>>; [key: string]: unknown }) {
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
      <Route path="/p/convite/:token" component={PublicInvite} />

      <Route path="/" component={() => <ProtectedRoute component={SelectWedding} />} />
      <Route path="/weddings/:weddingId/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/weddings/:weddingId/edit" component={() => <ProtectedRoute component={EditWedding} />} />
      <Route path="/weddings/:weddingId/guests" component={() => <ProtectedRoute component={Guests} />} />
      <Route path="/weddings/:weddingId/gifts" component={() => <ProtectedRoute component={Gifts} />} />
      <Route path="/weddings/:weddingId/extract" component={() => <ProtectedRoute component={Extract} />} />
      <Route path="/weddings/:weddingId/tasks" component={() => <ProtectedRoute component={Tasks} />} />
      <Route path="/weddings/:weddingId/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/weddings/:weddingId/schedule" component={() => <ProtectedRoute component={Schedule} />} />
      <Route path="/weddings/:weddingId/vendors" component={() => <ProtectedRoute component={Vendors} />} />
      <Route path="/weddings/:weddingId/coordinators" component={() => <ProtectedRoute component={Coordinators} />} />
      <Route path="/weddings/:weddingId/messages" component={() => <ProtectedRoute component={Messages} />} />
      <Route path="/weddings/:weddingId/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/weddings/:weddingId/seating" component={() => <ProtectedRoute component={Seating} />} />
      <Route path="/weddings/:weddingId/checkout" component={() => <ProtectedRoute component={Checkout} />} />
      <Route path="/weddings/:weddingId/public-invite-templates" component={() => <ProtectedRoute component={PublicInviteTemplates} />} />

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
