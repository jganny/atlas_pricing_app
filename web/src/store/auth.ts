import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/lib/types";
import { atlasApi, useLiveData } from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  authReady: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      authReady: !useLiveData,
      error: null,
      setUser(user) {
        set({ user, error: null });
      },
      setAuthReady(authReady) {
        set({ authReady });
      },
      async login(username, password) {
        set({ loading: true, error: null });
        try {
          const user = await atlasApi.login(username, password);
          set({ user, loading: false, authReady: true });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : "Login failed",
          });
          throw err;
        }
      },
      async logout() {
        await atlasApi.logout();
        set({ user: null, error: null });
      },
    }),
    {
      name: "atlas-react-auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
