import { NextRequest } from 'next/server'
import { DocumentRequestUsecase } from '@/src/modules/v1/server/document-request/usecases/document-request.usecase'
import { documentRequestQuerySchema } from '@/src/modules/v1/server/document-request/domains/document-request.dto'
import { apiError } from '@/src/shared/utils/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page')) || 1
    const perPage = Number(searchParams.get('perPage') || searchParams.get('per_page')) || 20
    const keywords = searchParams.get('keywords') || searchParams.get('q') || undefined
    const status = searchParams.get('status') || undefined
    const categoryId = searchParams.get('categoryId')
      ? Number(searchParams.get('categoryId'))
      : undefined

    const query = documentRequestQuerySchema.parse({
      page,
      perPage,
      keywords,
      status,
      categoryId,
    })

    return await DocumentRequestUsecase.list(query)
  } catch (err: any) {
    return apiError(err.message || 'Terjadi kesalahan internal', 'E-500', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return await DocumentRequestUsecase.create(body)
  } catch (err: any) {
    return apiError(err.message || 'Terjadi kesalahan format data', 'E-400', 400)
  }
}

