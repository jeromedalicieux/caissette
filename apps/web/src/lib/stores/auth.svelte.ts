import { auth as authApi, setAuthToken, getAuthToken } from '$lib/api/client'

interface AuthUser {
  id: string
  shopId: string
  name: string
  email: string
  role: string
  permissionsJson: string | null
}

function createAuthStore() {
  let user = $state<AuthUser | null>(null)
  let loading = $state(true)

  return {
    get user() {
      return user
    },
    get loading() {
      return loading
    },
    get isAuthenticated() {
      return user !== null
    },
    get role() {
      return user?.role ?? null
    },
    get shopId() {
      return user?.shopId ?? null
    },

    async init() {
      const token = getAuthToken()
      if (!token) {
        loading = false
        return
      }
      try {
        const res = await authApi.me()
        user = res.user
      } catch {
        setAuthToken(null)
      }
      loading = false
    },

    async login(email: string, password: string, shopId: string) {
      const res = await authApi.login({ email, password, shopId })
      setAuthToken(res.token)
      user = res.user
      return res
    },

    async register(name: string, email: string, password: string, shopId: string) {
      const res = await authApi.register({ email, password, name, shopId, role: 'owner' })
      setAuthToken(res.token)
      user = res.user
      return res
    },

    async pinLogin(pin: string, shopId: string) {
      const res = await authApi.pinLogin({ pin, shopId })
      setAuthToken(res.token)
      user = res.user
      return res
    },

    async logout() {
      try {
        await authApi.logout()
      } catch {
        // ignore
      }
      setAuthToken(null)
      user = null
    },
  }
}

export const authStore = createAuthStore()
