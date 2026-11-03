'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/src/components/ui/dialog'
import { DocumentRequestRepository } from '../../repositories/document-request.repository'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  item: {
    id: number
    documentNumber: string
    title: string
  } | null
  mode: 'approve' | 'reject'
}

export function ApprovalReviewModal({ open, onClose, onSuccess, item, mode }: Props) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!item) return null

  const isReject = mode === 'reject'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isReject && !comment.trim()) {
      toast.error('Alasan penolakan (comment) wajib diisi saat menolak dokumen')
      return
    }

    setSubmitting(true)
    try {
      if (isReject) {
        await DocumentRequestRepository.reject(item!.id, comment.trim())
        toast.success(`Dokumen ${item!.documentNumber} berhasil ditolak`)
      } else {
        await DocumentRequestRepository.approve(item!.id, comment.trim() || undefined)
        toast.success(`Dokumen ${item!.documentNumber} berhasil disetujui`)
      }

      setComment('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses persetujuan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            {isReject ? (
              <XCircle className="text-red-500" size={20} />
            ) : (
              <CheckCircle2 className="text-emerald-500" size={20} />
            )}
            <DialogTitle>
              {isReject ? 'Tolak Pengajuan Dokumen' : 'Setujui Pengajuan Dokumen'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isReject
              ? 'Penolakan akan menghentikan alur proses dokumen secara final.'
              : 'Persetujuan Anda akan melanjutkan dokumen ke step berikutnya atau menyelesaikan approval.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase">Nomor Dokumen</p>
            <p className="font-medium text-slate-800">{item.documentNumber}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase mt-2">Judul</p>
            <p className="text-slate-700">{item.title}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isReject ? (
                <>
                  Alasan Penolakan <span className="text-red-500">* (Wajib)</span>
                </>
              ) : (
                'Catatan / Komentar (Opsional)'
              )}
            </label>
            <textarea
              rows={3}
              required={isReject}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isReject
                  ? 'Tuliskan alasan mengapa dokumen ini ditolak...'
                  : 'Tuliskan catatan persetujuan jika ada...'
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={
                isReject
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Memproses...
                </div>
              ) : isReject ? (
                'Tolak Dokumen'
              ) : (
                'Setujui Dokumen'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

