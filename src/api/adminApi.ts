/**
 * Admin client for the approval queue. Admin operations only exist on the
 * real backend — there is deliberately no bundled fallback here.
 */
import type { ApiResponse, Member } from './types'

export interface PendingMember extends Member {
  cvFileName: string | null
  status: 'pending' | 'approved'
  createdAt: string
}

const baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function adminRequest<T>(path: string, adminKey: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
  })
  if (response.status === 401) throw new Error('unauthorized')
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success || body.data === null) throw new Error(body.error ?? 'request-failed')
  return body.data
}

export const adminApi = {
  login: (adminKey: string): Promise<{ authenticated: boolean }> =>
    adminRequest('/admin/login', adminKey, { method: 'POST' }),
  listPending: (adminKey: string): Promise<PendingMember[]> =>
    adminRequest('/admin/pending', adminKey),
  approve: (adminKey: string, id: string): Promise<PendingMember> =>
    adminRequest(`/admin/members/${encodeURIComponent(id)}/approve`, adminKey, { method: 'POST' }),
  reject: (adminKey: string, id: string): Promise<{ id: string; rejected: boolean }> =>
    adminRequest(`/admin/members/${encodeURIComponent(id)}/reject`, adminKey, { method: 'POST' }),
}
