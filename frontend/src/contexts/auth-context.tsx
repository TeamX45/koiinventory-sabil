/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokenStorage } from "@/api/client";

export type Role = "owner" | "admin" | "staff";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  avatar?: string | null;
  phone?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  canManageUsers: () => boolean;
}

const USER_KEY = "dk_koi_user";

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // Hydrate dari localStorage instan — tidak ada loading state, render langsung
  const [user, setUser] = useState<AuthUser | null>(() =>
    tokenStorage.get() ? readCachedUser() : null,
  );

  const refresh = useCallback(async () => {
    if (!tokenStorage.get()) {
      setUser(null);
      writeCachedUser(null);
      return;
    }
    try {
      const { data } = await api.get<{ data: AuthUser }>("/v1/auth/me");
      setUser(data.data);
      writeCachedUser(data.data);
    } catch {
      // axios interceptor sudah menangani 401 (clear token + redirect ke /login)
    }
  }, []);

  // Background validation token tanpa block UI
  useEffect(() => {
    if (tokenStorage.get()) {
      refresh();
    }
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ data: AuthUser; token: string }>(
        "/v1/auth/login",
        { email, password },
      );
      tokenStorage.set(data.token);
      writeCachedUser(data.data);
      setUser(data.data);
      qc.clear();
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/v1/auth/logout");
    } catch {
      // ignore — tetap clear lokal
    }
    tokenStorage.clear();
    writeCachedUser(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const hasRole = useCallback(
    (...roles: Role[]) => !!user && roles.includes(user.role),
    [user],
  );

  const canManageUsers = useCallback(() => user?.role === "owner", [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        refresh,
        hasRole,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
