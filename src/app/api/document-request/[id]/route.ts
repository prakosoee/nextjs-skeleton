import { NextRequest } from 'next/server'
import { DocumentRequestUsecase } from '@/src/modules/v1/server/document-request/usecases/document-request.usecase'
import { apiError } from '@/src/shared/utils/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return await DocumentRequestUsecase.detail(Number(id))
  } catch (err: any) {
    return apiError(err.message || 'Terjadi kesalahan server', 'E-500', 500)
  }
}

