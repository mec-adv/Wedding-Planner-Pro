import { create } from 'zustand';
import { useGetMe, useLogin, useRegister, type LoginInput, type RegisterInput, type User } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null });
    window.location.href = '/login';
  },
}));

export function useAuth() {
  const { token, logout, setToken } = useAuthStore();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setToken(data.token);
        queryClient.setQueryData(['/api/auth/me'], data.user);
      }
    }
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setToken(data.token);
        queryClient.setQueryData(['/api/auth/me'], data.user);
      }
    }
  });

  return {
    user,
    isLoading: isLoading && !!token,
    isAuthenticated: !!user && !!token,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}
