'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Layers,
  History,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useTitle } from '@/src/shared/contexts/TitleContext'
import { formatDateTime } from '@/src/shared/utils/format'
import { DocumentRequestRepository } from '../repositories/document-request.repository'
import type { DocumentRequestDetail } from '../domains/document-request.entity'
import { ApprovalReviewModal } from './components/ApprovalReviewModal'

export function DocumentRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { setTitle } = useTitle()

  const id = Number(params?.id)
  const [data, setData] = useState<DocumentRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Review modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'approve' | 'reject'>('approve')

  useEffect(() => {
    setTitle('Detail Pengajuan Dokumen', 'Informasi dokumen, alur approval, dan riwayat audit')
  }, [setTitle])

  const fetchDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await DocumentRequestRepository.getById(id)
      setData(res)
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat detail dokumen')
      router.push('/dashboard/document-request')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    )
  }

  if (!data) return null

  const currentUserId = session?.user?.id ? Number(session.user.id) : null
  const isRequester = currentUserId === data.userId
  const isPending = data.status === 'pending'
  const isFinal = data.status === 'approved' || data.status === 'rejected'

  // Cek apakah user saat ini adalah approver pada step yang aktif
  const isActiveApprover =
    isPending &&
    data.currentApprover &&
    currentUserId === data.currentApprover.id &&
    !isRequester

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={14} /> Disetujui (Approved)
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle size={14} /> Ditolak (Rejected)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={14} /> Menunggu Persetujuan (Pending)
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <Link
          href="/dashboard/document-request"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Daftar Dokumen
        </Link>
      </div>

      {/* Header Document Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {data.documentNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {data.categoryName}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-2">{data.title}</h1>
          </div>
          <div>{getStatusBadge(data.status)}</div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <User size={16} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Pemohon</p>
              <p className="font-semibold text-slate-800">{data.requesterName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar size={16} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Tanggal Pengajuan</p>
              <p className="font-medium text-slate-800">
                {formatDateTime(data.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Layers size={16} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Alur Approval</p>
              <p className="font-medium text-slate-800">
                {data.workflowName || 'Default Line'} ({data.totalSteps} Steps)
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Deskripsi / Ringkasan
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 p-3.5 rounded-lg border border-slate-100">
              {data.description}
            </p>
          </div>
        )}
      </div>

      {/* Action Banner (Approver Actions or Self-Approval Notice) */}
      {isActiveApprover && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <Clock className="text-blue-600" size={18} />
              Menunggu Persetujuan Anda (Step {data.currentStep} dari {data.totalSteps})
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              Sebagai approver step aktif, Anda berhak menyetujui atau menolak dokumen ini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setModalMode('approve')
                setModalOpen(true)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs h-9 px-4"
            >
              <CheckCircle2 size={15} /> Setujui Dokumen
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setModalMode('reject')
                setModalOpen(true)
              }}
              className="border-red-200 bg-white text-red-600 hover:bg-red-50 flex items-center gap-1.5 text-xs h-9 px-4"
            >
              <XCircle size={15} /> Tolak Dokumen
            </Button>
          </div>
        </div>
      )}

      {isRequester && isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-sm">
          <ShieldAlert size={20} className="text-amber-600 shrink-0" />
          <p>
            <strong>Self-Approval Guard:</strong> Anda adalah pemohon dokumen ini. Sistem melarang
            pemohon untuk menyetujui pengajuannya sendiri demi kepatuhan SOP perusahaan.
          </p>
        </div>
      )}

      {/* Visual Step Tracker Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Layers size={18} className="text-blue-600" />
          Progress Tahapan Persetujuan
        </h3>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.steps.map((step) => {
              const isActive = isPending && step.stepNumber === data.currentStep
              const isDone = step.status === 'approved'
              const isRejected = step.status === 'rejected'
              const isWaiting = step.status === 'waiting' || (step.status === 'pending' && !isActive)

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-100 shadow-sm'
                      : isDone
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : isRejected
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Step {step.stepNumber}
                    </span>
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 size={14} /> Approved
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                        <XCircle size={14} /> Rejected
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse">
                        <Clock size={14} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                        Waiting
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-slate-800 text-sm">{step.approverName}</p>
                  <p className="text-xs text-slate-400">{step.approverEmail || 'Approver'}</p>

                  {step.approvedAt && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Selesai: {formatDateTime(step.approvedAt)}
                    </p>
                  )}

                  {step.notes && (
                    <div className="mt-2 text-xs bg-white/80 p-2 rounded border border-slate-100 text-slate-700">
                      &quot;{step.notes}&quot;
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Audit Timeline Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
          <History size={18} className="text-blue-600" />
          Riwayat &amp; Audit Trail
        </h3>

        {data.timeline.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Belum ada riwayat tercatat.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {data.timeline.map((item) => {
              const isSubmit = item.action === 'submit'
              const isApprove = item.action === 'approve'
              const isReject = item.action === 'reject'

              return (
                <div key={item.id} className="relative">
                  {/* Bullet Icon */}
                  <span
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                      isSubmit
                        ? 'bg-blue-500 text-white'
                        : isApprove
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {isSubmit && <FileText size={10} />}
                    {isApprove && <CheckCircle2 size={10} />}
                    {isReject && <XCircle size={10} />}
                  </span>

                  <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <span className="text-sm font-semibold text-slate-800">
                        {isSubmit
                          ? 'Pengajuan Dokumen Dibuat'
                          : isApprove
                          ? `Disetujui pada Step ${item.stepNumber}`
                          : `Ditolak pada Step ${item.stepNumber}`}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      Oleh: <strong className="text-slate-700">{isSubmit ? (data.requesterName || 'Pemohon') : item.actorName}</strong>
                    </p>

                    {item.comment && (
                      <p className="mt-2 text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                        Catatan: &quot;{item.comment}&quot;
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ApprovalReviewModal
        open={modalOpen}
        mode={modalMode}
        item={data}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchDetail()}
      />
    </div>
  )
}
