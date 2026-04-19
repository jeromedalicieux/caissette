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
  list(status = 'available', type?: string) {
    const params = new URLSearchParams({ status })
    if (type) params.set('type', type)
    return request<any[]>(`/api/items?${params.toString()}`)
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
  list(params?: { start?: string; end?: string; payment?: string; status?: string }) {
    const qs = new URLSearchParams()
    if (params?.start) qs.set('start', params.start)
    if (params?.end) qs.set('end', params.end)
    if (params?.payment) qs.set('payment', params.payment)
    if (params?.status) qs.set('status', params.status)
    const query = qs.toString()
    return request<any[]>(`/api/sales${query ? '?' + query : ''}`)
  },

  get(id: string) {
    return request<any>(`/api/sales/${id}`)
  },

  create(data: {
    cashierId: string
    paymentMethod: string
    payments?: Array<{ method: string; amount: number }>
    discountAmount?: number
    items: Array<{
      itemId?: string
      name: string
      price: number
      quantity?: number
      discount?: number
      type?: string
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

  refund(id: string) {
    return request<{ id: string; receiptNumber: number; hash: string }>(`/api/sales/${id}/refund`, {
      method: 'POST',
    })
  },
}

// ─── Reversements ───

export const reversementsApi = {
  list(depositorId?: string) {
    const qs = depositorId ? `?depositorId=${depositorId}` : ''
    return request<any[]>(`/api/reversements${qs}`)
  },

  create(data: { depositorId: string; periodStart: number; periodEnd: number }) {
    return request<{ id: string; totalSales: number; totalCommission: number; totalReversement: number }>('/api/reversements', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  markPaid(id: string, paymentMethod: string) {
    return request<{ ok: boolean }>(`/api/reversements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paid', paymentMethod }),
    })
  },

  cancel(id: string) {
    return request<{ ok: boolean }>(`/api/reversements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
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

// ─── Invoices ───

export const invoiceApi = {
  generate(saleId: string, client?: { name?: string; address?: string; siret?: string }) {
    return request<any>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ saleId, ...client }),
    })
  },
}

// ─── VAT ───

export const vatApi = {
  summary(start: string, end: string) {
    return request<any>(`/api/vat-summary?start=${start}&end=${end}`)
  },
}

// ─── CSV Export ───

export const csvExport = {
  async download(start: string, end: string) {
    const token = getAuthToken()
    const res = await fetch(`${API_BASE}/api/export/csv?start=${start}&end=${end}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new ApiError(res.status, (body as any).error ?? 'Erreur serveur')
    }
    const blob = await res.blob()
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'ventes.csv'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}

// ─── Dashboard ───

export const dashboard = {
  get() {
    return request<{
      today: { ca: number; count: number }
      month: { ca: number; count: number }
      topArticles: Array<{ name: string; count: number; revenue: number }>
      byPayment: Record<string, number>
    }>('/api/dashboard')
  },
}

// ─── Attestation ───

export const attestation = {
  get() {
    return request<any>('/api/attestation')
  },
}
