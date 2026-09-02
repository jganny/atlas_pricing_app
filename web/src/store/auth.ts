import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/lib/types'
import { mockApi } from '@/lib/mock/api'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      error: null,
      async login(username, password) {
        set({ loading: true, error: null })
        try {
          const user = await mockApi.login(username, password)
          set({ user, loading: false })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Login failed',
          })
          throw err
        }
      },
      logout() {
        set({ user: null, error: null })
      },
    }),
    { name: 'atlas-react-auth' },
  ),
)
