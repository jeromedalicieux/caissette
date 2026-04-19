import type { Shop, ShopSettings } from '@rebond/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('rebond_token', token)
  } else {
    localStorage.removeItem('rebond_token')
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken
  if (typeof localStorage !== 'undefined') {
    authToken = localStorage.getItem('rebond_token')
  }
  return authToken
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, (body as any).error ?? 'Erreur serveur')
  }

  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Auth ───

export const auth = {
  register(data: { email: string; password: string; name: string; shopId: string; role?: string }) {
    return request<{ user: any; token: string; expiresAt: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  login(data: { email: string; password: string; shopId: string }) {
    return request<{ user: any; token: string; expiresAt: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  pinLogin(data: { pin: string; shopId: string }) {
    return request<{ user: any; token: string; expiresAt: number }>('/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  logout() {
    return request('/auth/logout', { method: 'POST' })
  },

  me() {
    return request<{ user: any }>('/auth/me')
  },
}

// ─── Shops ───

export const shops = {
  create(data: { name: string; siret: string; address: string; vatRegime?: string }) {
    return request<{ id: string }>('/shops', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getCurrent() {
    return request<Shop & { settings: ShopSettings } & Record<string, any>>('/api/shop')
  },

  updateCurrent(data: Record<string, unknown>) {
    return request('/api/shop', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
}

// ─── Depositors ───

export const depositors = {
  list() {
    return request<any[]>('/api/depositors')
  },

  get(id: string) {
    return request<any>(`/api/depositors/${id}`)
  },

  create(data: Record<string, unknown>) {
    return request<{ id: string }>('/api/depositors', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/api/depositors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
}

// ─── Items ───

export const items = {
  list(status = 'available') {
    return request<any[]>(`/api/items?status=${status}`)
  },

  get(id: string) {
    return request<any>(`/api/items/${id}`)
  },

  create(data: Record<string, unknown>) {
    return request<{ id: string; sku: string }>('/api/items', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  remove(id: string) {
    return request<{ ok: boolean }>(`/api/items/${id}`, {
      method: 'DELETE',
    })
  },

  returnItem(id: string) {
    return request<{ ok: boolean }>(`/api/items/${id}/return`, {
      method: 'PATCH',
    })
  },
}

// ─── Contracts ───

export const contracts = {
  list() {
    return request<any[]>('/api/contracts')
  },

  get(id: string) {
    return request<any>(`/api/contracts/${id}`)
  },

  create(data: { depositorId: string; commissionRate: number; expiresAt: number }) {
    return request<{ id: string; number: string }>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(id: string, data: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/api/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
}

// ─── Police Ledger ───

export const policeLedger = {
  list() {
    return request<any[]>('/api/police-ledger')
  },
}

// ─── Sales ───

export const sales = {
  list() {
    return request<any[]>('/api/sales')
  },

  get(id: string) {
    return request<any>(`/api/sales/${id}`)
  },

  create(data: {
    cashierId: string
    paymentMethod: string
    items: Array<{
      itemId?: string
      name: string
      price: number
      costBasis?: number
      reversementAmount?: number
      depositorId?: string
      vatRegime: string
      vatRate: number
      commissionTtc?: number
    }>
    customerNote?: string
  }) {
    return request<{ id: string; receiptNumber: number; hash: string }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

// ─── Closures ───

export const closuresApi = {
  list() {
    return request<any[]>('/api/closures')
  },

  generate(type: 'daily' | 'monthly') {
    return request<any>('/api/closures', {
      method: 'POST',
      body: JSON.stringify({ type }),
    })
  },
}

// ─── Export ───

export const exportApi = {
  async downloadFec(start: string, end: string) {
    const token = getAuthToken()
    const res = await fetch(`${API_BASE}/api/export/fec?start=${start}&end=${end}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new ApiError(res.status, (body as any).error ?? 'Erreur serveur')
    }
    const blob = await res.blob()
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'FEC.txt'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}

// ─── Attestation ───

export const attestation = {
  get() {
    return request<any>('/api/attestation')
  },
}
