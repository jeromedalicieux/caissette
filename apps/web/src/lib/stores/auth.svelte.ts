import type { UserRole, ShopId, UserId } from '@rebond/types'

interface AuthUser {
  id: UserId
  shopId: ShopId
  name: string
  email: string
  role: UserRole
}

function createAuthStore() {
  let user = $state<AuthUser | null>(null)

  return {
    get user() {
      return user
    },
    get isAuthenticated() {
      return user !== null
    },
    get role() {
      return user?.role ?? null
    },
    login(userData: AuthUser) {
      user = userData
    },
    logout() {
      user = null
    },
  }
}

export const authStore = createAuthStore()
