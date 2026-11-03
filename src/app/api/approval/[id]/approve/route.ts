import { NextRequest } from 'next/server'
import { DocumentRequestUsecase } from '@/src/modules/v1/server/document-request/usecases/document-request.usecase'
import { apiError } from '@/src/shared/utils/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    let comment: string | undefined = undefined
    try {
      const body = await req.json()
      comment = body.comment
    } catch {
      // body optional untuk approve
    }
    return await DocumentRequestUsecase.review(Number(id), { action: 'approve', comment })
  } catch (err: any) {
    return apiError(err.message || 'Terjadi kesalahan saat approve', 'E-400', 400)
  }
}

