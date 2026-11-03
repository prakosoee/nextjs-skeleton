import type {
  DocumentRequest,
  DocumentRequestDetail,
  DocumentRequestList,
  ApprovalInboxList,
  CategoryOption,
} from '../domains/document-request.entity'

export const DocumentRequestRepository = {
  async getAll(
    page = 1,
    perPage = 20,
    keywords = '',
    status = 'all',
    categoryId?: number
  ): Promise<DocumentRequestList> {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    })

    if (keywords) params.set('keywords', keywords)
    if (status && status !== 'all') params.set('status', status)
    if (categoryId) params.set('categoryId', String(categoryId))

    const res = await fetch(`/api/document-request?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Gagal memuat daftar dokumen')
    }
    const json = await res.json()
    return json.data ?? json
  },

  async getById(id: number): Promise<DocumentRequestDetail> {
    const res = await fetch(`/api/document-request/${id}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Gagal memuat detail dokumen')
    }
    const json = await res.json()
    return json.data ?? json
  },

  async create(payload: { title: string; categoryId: number; description?: string }): Promise<DocumentRequest> {
    const res = await fetch('/api/document-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Gagal membuat pengajuan dokumen')
    }
    const json = await res.json()
    return json.data ?? json
  },

  async getInbox(page = 1, perPage = 20): Promise<ApprovalInboxList> {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    })

    const res = await fetch(`/api/approval/inbox?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Gagal memuat daftar tugas persetujuan')
    }
    const json = await res.json()
    return json.data ?? json
  },

  async approve(id: number, comment?: string): Promise<boolean> {
    const res = await fetch(`/api/approval/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Gagal menyetujui dokumen')
    }
    return true
  },

  async reject(id: number, comment: string): Promise<boolean> {
    const res = await fetch(`/api/approval/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Gagal menolak dokumen')
    }
    return true
  },

  async getCategories(): Promise<CategoryOption[]> {
    const res = await fetch('/api/master-data/category?perPage=100')
    if (!res.ok) return []
    const json = await res.json()
    const list = json.data?.items ?? json.data ?? []
    return list.map((c: { id: number | string; name: string; code?: string; description?: string }) => ({
      id: Number(c.id),
      name: c.name,
      code: c.code,
      description: c.description,
    }))
  },
}

