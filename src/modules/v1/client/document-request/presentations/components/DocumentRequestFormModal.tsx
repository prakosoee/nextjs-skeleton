'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
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
import type { CategoryOption } from '../../domains/document-request.entity'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DocumentRequestFormModal({ open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setCategoryId('')
      setDescription('')
      loadCategories()
    }
  }, [open])

  async function loadCategories() {
    setLoadingCategories(true)
    try {
      const data = await DocumentRequestRepository.getCategories()
      setCategories(data)
      if (data.length > 0) {
        setCategoryId(data[0].id)
      }
    } catch {
      toast.error('Gagal memuat kategori dokumen')
    } finally {
      setLoadingCategories(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Judul dokumen wajib diisi')
      return
    }

    if (!categoryId) {
      toast.error('Pilih kategori dokumen')
      return
    }

    setSubmitting(true)
    try {
      await DocumentRequestRepository.create({
        title: title.trim(),
        categoryId: Number(categoryId),
        description: description.trim() || undefined,
      })

      toast.success('Pengajuan dokumen berhasil dibuat!')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengajukan dokumen')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCat = categories.find((c) => c.id === Number(categoryId))

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pengajuan Dokumen Baru</DialogTitle>
          <DialogDescription>
            Isi metadata dokumen SOP yang akan diajukan ke dalam alur approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Judul Dokumen <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: SOP Penanganan Insiden Keamanan Sistem"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kategori Dokumen <span className="text-red-500">*</span>
            </label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                Memuat kategori...
              </div>
            ) : (
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedCat?.description && (
              <p className="mt-1 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                ℹ️ {selectedCat.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Deskripsi / Ringkasan Dokumen
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan tujuan atau ruang lingkup dokumen SOP ini..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingCategories}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Mengajukan...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Kirim Pengajuan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

