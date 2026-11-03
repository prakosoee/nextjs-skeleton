'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  Loader2,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useTitle } from '@/src/shared/contexts/TitleContext'
import { Pagination } from '@/src/shared/partials/Pagination'
import { formatDateTime } from '@/src/shared/utils/format'
import { DocumentRequestRepository } from '../repositories/document-request.repository'
import type { DocumentRequestList } from '../domains/document-request.entity'
import { DocumentRequestFormModal } from './components/DocumentRequestFormModal'

export function DocumentRequestPage() {
  const { data: session } = useSession()
  const { setTitle } = useTitle()

  const [pageData, setPageData] = useState<DocumentRequestList | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const canManage = session?.user?.permissions?.includes('document-request.manage')

  useEffect(() => {
    setTitle('Document Request', 'Daftar pengajuan dokumen dan status persetujuannya')
  }, [setTitle])

  const fetchData = useCallback(
    async (q: string, p: number, status: string) => {
      setLoading(true)
      try {
        const data = await DocumentRequestRepository.getAll(p, 10, q, status)
        setPageData(data)
      } catch (err: any) {
        toast.error(err.message || 'Gagal memuat daftar dokumen')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchData(debouncedSearch, page, statusFilter)
  }, [fetchData, debouncedSearch, page, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} /> Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <XCircle size={13} /> Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} /> Pending
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" size={20} />
            Daftar Pengajuan Dokumen
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola dan pantau proses verifikasi dokumen SOP per kategori
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shrink-0"
          >
            <Plus size={16} />
            Pengajuan Baru
          </Button>
        )}
      </div>

      {/* Filter & Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nomor dokumen atau judul..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'pending', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : !pageData || pageData.items.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-700">Belum ada pengajuan dokumen</p>
            <p className="text-xs text-slate-400 mt-1">
              Klik &quot;Pengajuan Baru&quot; untuk mengajukan dokumen pertama Anda
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
                  <th className="px-5 py-3 font-medium">Posisi Approval</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.items.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {doc.documentNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 max-w-xs truncate font-medium">
                      {doc.title}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        {doc.categoryName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {doc.requesterName || '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Step {doc.currentStep} dari {doc.totalSteps}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(doc.status)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {formatDateTime(doc.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/dashboard/document-request/${doc.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Eye size={13} />
                        Detail
                      </Link>
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

      {/* Form Modal */}
      <DocumentRequestFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchData(debouncedSearch, 1, statusFilter)}
      />
    </div>
  )
}

