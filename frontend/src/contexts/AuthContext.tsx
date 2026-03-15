import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api, setAuthToken } from "../api/client";
import type { AuthResponse, UserProfile } from "../api/client";

const TOKEN_KEY = "opencarapace_jwt";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    setAuthToken(t);
  }, []);

  const loadUser = useCallback(async (t: string) => {
    try {
      const profile = await api.get<UserProfile>("/api/users/me", {
        headers: { Authorization: `Bearer ${t}` },
      }).then((r) => r.data);
      setUser(profile);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, [setToken]);

  useEffect(() => {
    if (!token) {
      setAuthToken(null);
      setUser(null);
      setLoading(false);
      return;
    }
    setAuthToken(token);
    loadUser(token).finally(() => setLoading(false));
  }, [token, loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>("/api/auth/login", {
        email,
        password,
      });
      setToken(data.token);
      setUser({
        id: "",
        email: data.email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: "USER",
        createdAt: new Date().toISOString(),
      });
      await loadUser(data.token);
    },
    [setToken, loadUser]
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { data } = await api.post<AuthResponse>("/api/auth/register", {
        email,
        password,
        displayName: displayName || undefined,
      });
      setToken(data.token);
      setUser({
        id: "",
        email: data.email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: "USER",
        createdAt: new Date().toISOString(),
      });
      await loadUser(data.token);
    },
    [setToken, loadUser]
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const { data } = await api.post<AuthResponse>("/api/auth/google", {
        idToken,
      });
      setToken(data.token);
      setUser({
        id: "",
        email: data.email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: "USER",
        createdAt: new Date().toISOString(),
      });
      await loadUser(data.token);
    },
    [setToken, loadUser]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken]);

  const value: AuthContextValue = {
    token,
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
