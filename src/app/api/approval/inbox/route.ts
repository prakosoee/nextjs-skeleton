import { NextRequest } from 'next/server'
import { DocumentRequestUsecase } from '@/src/modules/v1/server/document-request/usecases/document-request.usecase'
import { apiError } from '@/src/shared/utils/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page')) || 1
    const perPage = Number(searchParams.get('perPage') || searchParams.get('per_page')) || 20

    return await DocumentRequestUsecase.getInbox(page, perPage)
  } catch (err: any) {
    return apiError(err.message || 'Terjadi kesalahan internal', 'E-500', 500)
  }
}

