import { auth } from '@/src/core/auth/auth'
import { DocumentRequestRepository } from '../repositories/document-request.repository'
import {
  createDocumentRequestSchema,
  reviewApprovalSchema,
  documentRequestQuerySchema,
  type CreateDocumentRequestDTO,
  type ReviewApprovalDTO,
  type DocumentRequestQueryDTO,
} from '../domains/document-request.dto'
import { apiUnauthorized, apiForbidden, apiSuccess, apiError } from '@/src/shared/utils/api-response'
import { Loggers } from '@/src/shared/utils/logger'

const logDoc = Loggers.document_request
const logApproval = Loggers.approval

export const DocumentRequestUsecase = {
  /**
   * Menampilkan daftar dokumen yang diajukan
   */
  async list(query: DocumentRequestQueryDTO) {
    const session = await auth()
    if (!session) return apiUnauthorized()

    if (!session.user.permissions?.includes('document-request.view')) {
      logDoc.warn('list forbidden', { user: session.user.name })
      return apiForbidden()
    }

    const isAdmin =
      session.user.roles?.includes('super-admin') || session.user.roles?.includes('admin')

    // Jika bukan admin, hanya tampilkan dokumen milik user yang login
    const filterUserId = isAdmin ? undefined : Number(session.user.id)

    const data = await DocumentRequestRepository.getAll(query, filterUserId)
    return apiSuccess(data)
  },

  /**
   * Menampilkan detail satu dokumen beserta snapshot step dan timeline audit
   */
  async detail(id: number) {
    const session = await auth()
    if (!session) return apiUnauthorized()

    if (!session.user.permissions?.includes('document-request.view')) {
      logDoc.warn('detail forbidden', { user: session.user.name, id })
      return apiForbidden()
    }

    const data = await DocumentRequestRepository.getById(id)
    if (!data) {
      return apiError('Dokumen tidak ditemukan', 'E-NOTFOUND', 404)
    }

    return apiSuccess(data)
  },

  /**
   * Membuat pengajuan dokumen baru
   */
  async create(body: CreateDocumentRequestDTO) {
    const session = await auth()
    if (!session) return apiUnauthorized()

    if (!session.user.permissions?.includes('document-request.manage')) {
      logDoc.warn('create forbidden', { user: session.user.name })
      return apiForbidden()
    }

    const parsed = createDocumentRequestSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Data pengajuan tidak valid'
      return apiError(firstError, 'E-VALIDATION', 400)
    }

    try {
      const result = await DocumentRequestRepository.createWithApprovalSnapshot(
        parsed.data,
        Number(session.user.id)
      )

      logDoc.info('created document request', {
        user: session.user.name,
        documentNumber: result.documentNumber,
        categoryId: parsed.data.categoryId,
      })

      return apiSuccess(result, 'Pengajuan dokumen berhasil dibuat')
    } catch (err: any) {
      logDoc.error('failed creating document request', { error: err.message })
      return apiError(err.message || 'Gagal membuat pengajuan dokumen', 'E-CREATE', 400)
    }
  },

  /**
   * Menampilkan daftar dokumen yang menunggu persetujuan (Inbox Approval)
   */
  async getInbox(page = 1, perPage = 20) {
    const session = await auth()
    if (!session) return apiUnauthorized()

    if (!session.user.permissions?.includes('approval.review')) {
      logApproval.warn('getInbox forbidden', { user: session.user.name })
      return apiForbidden()
    }

    const data = await DocumentRequestRepository.getInbox(Number(session.user.id), page, perPage)
    return apiSuccess(data)
  },

  /**
   * Memproses aksi Approve atau Reject dengan validasi guard ketat
   */
  async review(requestId: number, body: ReviewApprovalDTO) {
    const session = await auth()
    if (!session) return apiUnauthorized()

    if (!session.user.permissions?.includes('approval.review')) {
      logApproval.warn('review forbidden', { user: session.user.name, requestId })
      return apiForbidden()
    }

    const parsed = reviewApprovalSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Data review tidak valid'
      return apiError(firstError, 'E-VALIDATION', 400)
    }

    try {
      const result = await DocumentRequestRepository.processApprovalAction(
        requestId,
        Number(session.user.id),
        parsed.data.action,
        parsed.data.comment
      )

      logApproval.info('processed approval action', {
        user: session.user.name,
        requestId,
        action: parsed.data.action,
      })

      const msg =
        parsed.data.action === 'approve'
          ? 'Dokumen berhasil disetujui'
          : 'Dokumen berhasil ditolak'

      return apiSuccess(result, msg)
    } catch (err: any) {
      logApproval.warn('failed processing approval', {
        user: session.user.name,
        requestId,
        error: err.message,
      })
      return apiError(err.message || 'Gagal memproses persetujuan', 'E-APPROVAL', 400)
    }
  },
}

