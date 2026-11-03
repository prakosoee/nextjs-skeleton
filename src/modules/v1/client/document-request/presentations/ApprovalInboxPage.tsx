'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useTitle } from '@/src/shared/contexts/TitleContext'
import { Pagination } from '@/src/shared/partials/Pagination'
import { formatDateTime } from '@/src/shared/utils/format'
import { DocumentRequestRepository } from '../repositories/document-request.repository'
import type { ApprovalInboxList, ApprovalInboxItem } from '../domains/document-request.entity'
import { ApprovalReviewModal } from './components/ApprovalReviewModal'

export function ApprovalInboxPage() {
  const { setTitle } = useTitle()

  const [pageData, setPageData] = useState<ApprovalInboxList | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Review modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'approve' | 'reject'>('approve')
  const [selectedItem, setSelectedItem] = useState<{
    id: number
    documentNumber: string
    title: string
  } | null>(null)

  useEffect(() => {
    setTitle('Approval Inbox', 'Daftar dokumen SOP yang menunggu persetujuan Anda')
  }, [setTitle])

  const fetchData = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const data = await DocumentRequestRepository.getInbox(p, 10)
      setPageData(data)
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat daftar inbox')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(page)
  }, [fetchData, page])

  function handleAction(item: ApprovalInboxItem, mode: 'approve' | 'reject') {
    setSelectedItem({
      id: item.id,
      documentNumber: item.documentNumber,
      title: item.title,
    })
    setModalMode(mode)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Inbox className="text-blue-600" size={20} />
            Inbox Persetujuan
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar pengajuan yang saat ini berada pada giliran step approval Anda
          </p>
        </div>

        {pageData && pageData.pagination.total > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            {pageData.pagination.total} Tugas Menunggu
          </span>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : !pageData || pageData.items.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <ShieldCheck size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="font-semibold text-slate-700">Semua Beres!</p>
            <p className="text-sm text-slate-400 mt-1">
              Tidak ada dokumen yang menunggu persetujuan Anda saat ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-left">
                  <th className="px-5 py-3 font-medium">Nomor Dokumen</th>
                  <th className="px-5 py-3 font-medium">Judul Dokumen</th>
                  <th className="px-5 py-3 font-medium">Kategori</th>
                  <th className="px-5 py-3 font-medium">Pemohon</th>
                  <th className="px-5 py-3 font-medium">Giliran Step</th>
                  <th className="px-5 py-3 font-medium">Diajukan Pada</th>
                  <th className="px-5 py-3 font-medium text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {item.documentNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 font-medium max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        {item.categoryName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <div>{item.requesterName}</div>
                      <div className="text-xs text-slate-400">{item.requesterEmail}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock size={12} /> Step {item.stepNumber} dari {item.totalSteps}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {formatDateTime(item.submittedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/document-request/${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Eye size={13} /> Detail
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => handleAction(item, 'approve')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-2.5 flex items-center gap-1"
                        >
                          <CheckCircle2 size={13} /> Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(item, 'reject')}
                          className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-2.5 flex items-center gap-1"
                        >
                          <XCircle size={13} /> Tolak
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageData && (
          <Pagination
            page={page}
            totalPages={pageData.pagination.total_pages}
            total={pageData.pagination.total}
            perPage={pageData.pagination.per_page}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Review Modal */}
      <ApprovalReviewModal
        open={modalOpen}
        mode={modalMode}
        item={selectedItem}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchData(page)}
      />
    </div>
  )
}

