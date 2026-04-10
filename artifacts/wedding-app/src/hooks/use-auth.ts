import { create } from 'zustand';
import { useGetMe, useLogin, useRegister, type LoginInput, type RegisterInput, type User } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Verifica se o cookie de presença `auth_present` existe.
 * Este cookie não-httpOnly é definido pelo backend junto com o `auth_token` (httpOnly),
 * servindo apenas como indicador de sessão ativa — sem expor nenhum dado sensível.
 */
function hasAuthCookie(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith('auth_present='));
}

interface AuthState {
  logout: () => void;
}

export const useAuthStore = create<AuthState>(() => ({
  logout: async () => {
    // Invalida o cookie httpOnly no servidor e limpa o indicador de presença
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    document.cookie = 'auth_present=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/login';
  },
}));

export function useAuth() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  const sessionActive = hasAuthCookie();

  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: ['/api/auth/me'],
      // Só chama /me se o cookie de presença indicar sessão ativa, evitando requests desnecessários
      enabled: sessionActive,
      retry: false,
    },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        // Token já foi definido pelo backend como cookie httpOnly.
        // Apenas atualiza o cache do React Query para evitar refetch.
        queryClient.setQueryData(['/api/auth/me'], data.user);
      },
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(['/api/auth/me'], data.user);
      },
    },
  });

  return {
    user,
    isLoading: isLoading && sessionActive,
    isAuthenticated: !!user && sessionActive,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

export type { LoginInput, RegisterInput, User };
