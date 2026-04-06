import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken } from "../api/client";

export type Role = "admin" | "driver" | "student" | "parent";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  assignedBus?: string | null;
  linkedParent?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((t: string | null) => {
    setToken(t);
    setAccessToken(t);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<{ data: User }>("/api/auth/me");
    setUser(data.data);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("accessToken");
    if (raw) {
      applyToken(raw);
    }
    (async () => {
      try {
        await refreshUser();
      } catch {
        try {
          const { data } = await api.post<{ data: { accessToken: string } }>("/api/auth/refresh");
          const t = data.data.accessToken;
          applyToken(t);
          sessionStorage.setItem("accessToken", t);
          await refreshUser();
        } catch {
          applyToken(null);
          sessionStorage.removeItem("accessToken");
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [applyToken, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ data: { user: User; accessToken: string } }>(
        "/api/auth/login",
        { email, password }
      );
      applyToken(data.data.accessToken);
      sessionStorage.setItem("accessToken", data.data.accessToken);
      setUser(data.data.user);
    },
    [applyToken]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, confirmPassword: string) => {
      const { data } = await api.post<{ data: { user: User; accessToken: string } }>(
        "/api/auth/register",
        { name, email, password, confirmPassword }
      );
      applyToken(data.data.accessToken);
      sessionStorage.setItem("accessToken", data.data.accessToken);
      setUser(data.data.user);
    },
    [applyToken]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmNewPassword: string) => {
      await api.patch("/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      applyToken(null);
      sessionStorage.removeItem("accessToken");
      setUser(null);
    }
  }, [applyToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      accessToken,
      login,
      register,
      changePassword,
      logout,
      refreshUser,
    }),
    [user, loading, accessToken, login, register, changePassword, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
