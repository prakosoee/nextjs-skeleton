import { NextRequest } from 'next/server'
import { DocumentRequestUsecase } from '@/src/modules/v1/server/document-request/usecases/document-request.usecase'
import { apiError } from '@/src/shared/utils/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    return await DocumentRequestUsecase.review(Number(id), { action: 'reject', comment: body?.comment })
  } catch (err: any) {
    return apiError(err.message || 'Terjadi kesalahan saat reject', 'E-400', 400)
  }
}

