import { z } from 'zod'

export const createDocumentRequestSchema = z.object({
  title: z
    .string({ required_error: 'Judul dokumen wajib diisi' })
    .trim()
    .min(3, 'Judul dokumen minimal 3 karakter')
    .max(255, 'Judul dokumen maksimal 255 karakter'),
  description: z.string().trim().optional(),
  categoryId: z.coerce
    .number({ required_error: 'Kategori dokumen wajib dipilih' })
    .int()
    .positive('Pilih kategori yang valid'),
})

export type CreateDocumentRequestDTO = z.infer<typeof createDocumentRequestSchema>

export const reviewApprovalSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    required_error: 'Aksi approval harus berupa approve atau reject',
  }),
  comment: z.string().trim().optional(),
}).refine(
  (data) => {
    if (data.action === 'reject') {
      return !!data.comment && data.comment.length > 0
    }
    return true
  },
  {
    message: 'Komentar / alasan penolakan wajib diisi saat menolak dokumen',
    path: ['comment'],
  }
)

export type ReviewApprovalDTO = z.infer<typeof reviewApprovalSchema>

export const documentRequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  keywords: z.string().trim().optional(),
  status: z.enum(['all', 'pending', 'approved', 'rejected']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
})

export type DocumentRequestQueryDTO = z.infer<typeof documentRequestQuerySchema>

