import { db, schema } from '@/src/core/db'
import { eq, and, isNull, or, count, desc, asc, sql } from 'drizzle-orm'
import type {
  DocumentRequest,
  DocumentRequestDetail,
  ApprovalInboxItem,
  ApprovalStepSnapshot,
  ApprovalAuditLog,
  DocumentRequestStatus,
} from '../domains/document-request.entity'
import type { DocumentRequestList, ApprovalInboxList } from '../domains/document-request.list'
import type { CreateDocumentRequestDTO, DocumentRequestQueryDTO } from '../domains/document-request.dto'

const {
  trsDocumentRequests,
  cfgCategoryWorkflows,
  approvalWorkflows,
  approvalSteps,
  approvalInstances,
  approvalInstanceSteps,
  approvalLogs,
  mstCategories,
  mstUsers,
} = schema

export const DocumentRequestRepository = {
  /**
   * Mengambil mapping workflow dan daftar langkah approval berdasarkan kategori dokumen
   */
  async resolveWorkflowByCategory(categoryId: number) {
    // 1. Ambil mapping category ke workflow
    const mapping = await db
      .select({
        workflowId: cfgCategoryWorkflows.workflowId,
      })
      .from(cfgCategoryWorkflows)
      .where(eq(cfgCategoryWorkflows.categoryId, categoryId))
      .limit(1)

    if (!mapping || mapping.length === 0) return null
    const workflowId = Number(mapping[0].workflowId)

    // 2. Ambil workflow template
    const [workflow] = await db
      .select()
      .from(approvalWorkflows)
      .where(eq(approvalWorkflows.id, workflowId))
      .limit(1)

    if (!workflow) return null

    // 3. Ambil steps dan data user approver
    const steps = await db
      .select({
        id: approvalSteps.id,
        workflowId: approvalSteps.workflowId,
        step: approvalSteps.step,
        groupNo: approvalSteps.groupNo,
        code: approvalSteps.code,
        approverType: approvalSteps.approverType,
        jobLevelId: approvalSteps.jobLevelId,
        userId: approvalSteps.userId,
        divisionId: approvalSteps.divisionId,
        jobPositionId: approvalSteps.jobPositionId,
        groupType: approvalSteps.groupType,
        minApproval: approvalSteps.minApproval,
        isRequired: approvalSteps.isRequired,
        allowedActions: approvalSteps.allowedActions,
        approverName: mstUsers.name,
        approverEmail: mstUsers.email,
      })
      .from(approvalSteps)
      .leftJoin(mstUsers, eq(approvalSteps.userId, mstUsers.id))
      .where(eq(approvalSteps.workflowId, workflowId))
      .orderBy(asc(approvalSteps.step))

    return {
      workflow,
      steps: steps.map((s) => ({
        ...s,
        approverUser: s.userId
          ? {
              id: s.userId,
              name: s.approverName,
              email: s.approverEmail,
            }
          : null,
      })),
    }
  },

  /**
   * Membuat pengajuan dokumen baru dan men-snapshot approval line per category
   */
  async createWithApprovalSnapshot(
    payload: CreateDocumentRequestDTO,
    userId: number
  ): Promise<DocumentRequest> {
    const resolved = await this.resolveWorkflowByCategory(payload.categoryId)
    if (!resolved || resolved.steps.length === 0) {
      throw new Error('Alur persetujuan (approval line) belum dikonfigurasi untuk kategori ini')
    }

    const { workflow, steps } = resolved

    // Generate nomor dokumen unik: DOC-YYYYMM-XXXX
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '')
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const documentNumber = `DOC-${dateStr}-${randomSuffix}`

    return await db.transaction(async (tx) => {
      // 1. Insert ke tabel trs_document_requests
      const [newDoc] = await tx
        .insert(trsDocumentRequests)
        .values({
          documentNumber,
          title: payload.title,
          description: payload.description || null,
          categoryId: payload.categoryId,
          userId,
          status: 'pending',
          currentStep: 1,
          totalSteps: steps.length,
        })
        .returning()

      // 2. Insert ke approval_instances
      const [instance] = await tx
        .insert(approvalInstances)
        .values({
          workflowId: workflow.id,
          modelType: 'document_request',
          modelId: String(newDoc.id),
          currentStep: 1,
          status: 'pending',
        })
        .returning()

      // 3. Snapshot steps ke approval_instance_steps
      let firstInstanceStepId: number | null = null

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        const isFirst = i === 0
        const approverId = s.userId || userId
        const approverName = s.approverUser?.name || 'Approver'

        const [createdStep] = await tx
          .insert(approvalInstanceSteps)
          .values({
            instanceId: instance.id,
            stepId: s.id,
            approverUserId: approverId,
            status: isFirst ? 'pending' : 'waiting',
            employeeName: approverName,
          })
          .returning()

        if (isFirst) {
          firstInstanceStepId = createdStep.id
        }
      }

      // 4. Catat audit log inisiasi pengajuan di approval_logs
      if (firstInstanceStepId) {
        await tx.insert(approvalLogs).values({
          instanceStepId: firstInstanceStepId,
          action: 'submit',
          comment: 'Dokumen diajukan untuk proses approval',
        })
      }

      return {
        id: Number(newDoc.id),
        documentNumber: newDoc.documentNumber,
        title: newDoc.title,
        description: newDoc.description,
        categoryId: Number(newDoc.categoryId),
        userId: Number(newDoc.userId),
        status: newDoc.status as DocumentRequestStatus,
        currentStep: Number(newDoc.currentStep),
        totalSteps: Number(newDoc.totalSteps),
        createdAt: newDoc.createdAt ? new Date(newDoc.createdAt).toISOString() : '',
        updatedAt: newDoc.updatedAt ? new Date(newDoc.updatedAt).toISOString() : '',
      }
    })
  },

  /**
   * Mengambil daftar pengajuan dokumen (untuk Requester & Admin)
   */
  async getAll(query: DocumentRequestQueryDTO, filterUserId?: number): Promise<DocumentRequestList> {
    const { page, perPage, keywords, status, categoryId } = query
    const conditions = [isNull(trsDocumentRequests.deletedAt)]

    if (filterUserId) {
      conditions.push(eq(trsDocumentRequests.userId, filterUserId))
    }

    if (status && status !== 'all') {
      conditions.push(eq(trsDocumentRequests.status, status))
    }

    if (categoryId) {
      conditions.push(eq(trsDocumentRequests.categoryId, categoryId))
    }

    if (keywords) {
      conditions.push(
        or(
          sql`${trsDocumentRequests.title} ILIKE ${`%${keywords}%`}`,
          sql`${trsDocumentRequests.documentNumber} ILIKE ${`%${keywords}%`}`
        )!
      )
    }

    const where = and(...conditions)

    const [data, totalCount] = await Promise.all([
      db
        .select({
          id: trsDocumentRequests.id,
          documentNumber: trsDocumentRequests.documentNumber,
          title: trsDocumentRequests.title,
          description: trsDocumentRequests.description,
          categoryId: trsDocumentRequests.categoryId,
          categoryName: mstCategories.name,
          categoryCode: mstCategories.code,
          userId: trsDocumentRequests.userId,
          requesterName: mstUsers.name,
          requesterEmail: mstUsers.email,
          status: trsDocumentRequests.status,
          currentStep: trsDocumentRequests.currentStep,
          totalSteps: trsDocumentRequests.totalSteps,
          createdAt: trsDocumentRequests.createdAt,
          updatedAt: trsDocumentRequests.updatedAt,
        })
        .from(trsDocumentRequests)
        .innerJoin(mstCategories, eq(trsDocumentRequests.categoryId, mstCategories.id))
        .innerJoin(mstUsers, eq(trsDocumentRequests.userId, mstUsers.id))
        .where(where)
        .orderBy(desc(trsDocumentRequests.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db
        .select({ value: count() })
        .from(trsDocumentRequests)
        .innerJoin(mstCategories, eq(trsDocumentRequests.categoryId, mstCategories.id))
        .where(where),
    ])

    const total = Number(totalCount[0]?.value ?? 0)

    return {
      items: data.map((d) => ({
        id: Number(d.id),
        documentNumber: d.documentNumber,
        title: d.title,
        description: d.description,
        categoryId: Number(d.categoryId),
        categoryName: d.categoryName,
        categoryCode: d.categoryCode,
        userId: Number(d.userId),
        requesterName: d.requesterName,
        requesterEmail: d.requesterEmail,
        status: d.status as DocumentRequestStatus,
        currentStep: Number(d.currentStep),
        totalSteps: Number(d.totalSteps),
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : '',
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',
      })),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    }
  },

  /**
   * Mengambil detail lengkap pengajuan dokumen, alur approval, dan timeline audit
   */
  async getById(id: number): Promise<DocumentRequestDetail | null> {
    const doc = await db
      .select({
        id: trsDocumentRequests.id,
        documentNumber: trsDocumentRequests.documentNumber,
        title: trsDocumentRequests.title,
        description: trsDocumentRequests.description,
        categoryId: trsDocumentRequests.categoryId,
        categoryName: mstCategories.name,
        categoryCode: mstCategories.code,
        userId: trsDocumentRequests.userId,
        requesterName: mstUsers.name,
        requesterEmail: mstUsers.email,
        status: trsDocumentRequests.status,
        currentStep: trsDocumentRequests.currentStep,
        totalSteps: trsDocumentRequests.totalSteps,
        createdAt: trsDocumentRequests.createdAt,
        updatedAt: trsDocumentRequests.updatedAt,
      })
      .from(trsDocumentRequests)
      .innerJoin(mstCategories, eq(trsDocumentRequests.categoryId, mstCategories.id))
      .innerJoin(mstUsers, eq(trsDocumentRequests.userId, mstUsers.id))
      .where(and(eq(trsDocumentRequests.id, id), isNull(trsDocumentRequests.deletedAt)))
      .limit(1)

    if (!doc || doc.length === 0) return null
    const item = doc[0]

    // Cari instance approval yang terhubung
    const [instance] = await db
      .select({
        id: approvalInstances.id,
        workflowId: approvalInstances.workflowId,
        modelType: approvalInstances.modelType,
        modelId: approvalInstances.modelId,
        currentStep: approvalInstances.currentStep,
        status: approvalInstances.status,
        workflowName: approvalWorkflows.name,
      })
      .from(approvalInstances)
      .leftJoin(approvalWorkflows, eq(approvalInstances.workflowId, approvalWorkflows.id))
      .where(
        and(
          eq(approvalInstances.modelType, 'document_request'),
          eq(approvalInstances.modelId, String(id))
        )
      )
      .limit(1)

    const steps: ApprovalStepSnapshot[] = []
    const timeline: ApprovalAuditLog[] = []
    let currentApprover: DocumentRequestDetail['currentApprover'] = null

    if (instance) {
      // Ambil snapshot steps
      const instanceSteps = await db
        .select({
          id: approvalInstanceSteps.id,
          instanceId: approvalInstanceSteps.instanceId,
          stepId: approvalInstanceSteps.stepId,
          stepNumber: approvalSteps.step,
          approverUserId: approvalInstanceSteps.approverUserId,
          approverName: mstUsers.name,
          approverEmail: mstUsers.email,
          status: approvalInstanceSteps.status,
          approvedAt: approvalInstanceSteps.approvedAt,
          notes: approvalInstanceSteps.notes,
          createdAt: approvalInstanceSteps.createdAt,
        })
        .from(approvalInstanceSteps)
        .innerJoin(approvalSteps, eq(approvalInstanceSteps.stepId, approvalSteps.id))
        .innerJoin(mstUsers, eq(approvalInstanceSteps.approverUserId, mstUsers.id))
        .where(eq(approvalInstanceSteps.instanceId, instance.id))
        .orderBy(asc(approvalSteps.step))

      for (const s of instanceSteps) {
        steps.push({
          id: Number(s.id),
          instanceId: Number(s.instanceId),
          stepId: Number(s.stepId),
          stepNumber: Number(s.stepNumber),
          approverUserId: Number(s.approverUserId),
          approverName: s.approverName,
          approverEmail: s.approverEmail,
          status: s.status as ApprovalStepSnapshot['status'],
          approvedAt: s.approvedAt ? new Date(s.approvedAt).toISOString() : null,
          notes: s.notes,
          createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : '',
        })

        if (Number(s.stepNumber) === Number(instance.currentStep) && instance.status === 'pending') {
          currentApprover = {
            id: Number(s.approverUserId),
            name: s.approverName,
            email: s.approverEmail,
            stepNumber: Number(s.stepNumber),
          }
        }
      }

      // Ambil audit logs
      const stepIds = instanceSteps.map((s) => s.id)
      if (stepIds.length > 0) {
        const logs = await db
          .select({
            id: approvalLogs.id,
            instanceStepId: approvalLogs.instanceStepId,
            stepNumber: approvalSteps.step,
            actorName: mstUsers.name,
            action: approvalLogs.action,
            comment: approvalLogs.comment,
            createdAt: approvalLogs.createdAt,
          })
          .from(approvalLogs)
          .innerJoin(approvalInstanceSteps, eq(approvalLogs.instanceStepId, approvalInstanceSteps.id))
          .innerJoin(approvalSteps, eq(approvalInstanceSteps.stepId, approvalSteps.id))
          .innerJoin(mstUsers, eq(approvalInstanceSteps.approverUserId, mstUsers.id))
          .where(sql`${approvalLogs.instanceStepId} IN ${stepIds}`)
          .orderBy(asc(approvalLogs.createdAt))

        for (const l of logs) {
          const isSubmit = l.action === 'submit'
          timeline.push({
            id: Number(l.id),
            instanceStepId: Number(l.instanceStepId),
            stepNumber: Number(l.stepNumber),
            actorName: isSubmit ? (item.requesterName || 'Pemohon') : l.actorName,
            action: l.action as ApprovalAuditLog['action'],
            comment: l.comment,
            createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : '',
          })
        }
      }
    }

    return {
      id: Number(item.id),
      documentNumber: item.documentNumber,
      title: item.title,
      description: item.description,
      categoryId: Number(item.categoryId),
      categoryName: item.categoryName,
      categoryCode: item.categoryCode,
      userId: Number(item.userId),
      requesterName: item.requesterName,
      requesterEmail: item.requesterEmail,
      status: item.status as DocumentRequestStatus,
      currentStep: Number(item.currentStep),
      totalSteps: Number(item.totalSteps),
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : '',
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : '',
      workflowName: instance?.workflowName ?? undefined,
      steps,
      currentApprover,
      timeline,
    }
  },

  /**
   * Mengambil daftar tugas di Inbox Approval aktif khusus untuk approver yang sedang login
   */
  async getInbox(userId: number, page = 1, perPage = 20): Promise<ApprovalInboxList> {
    const baseCondition = and(
      eq(approvalInstances.status, 'pending'),
      eq(approvalInstances.modelType, 'document_request'),
      eq(approvalInstanceSteps.approverUserId, userId),
      eq(approvalInstanceSteps.status, 'pending'),
      eq(approvalSteps.step, approvalInstances.currentStep),
      sql`${trsDocumentRequests.userId} != ${userId}`
    )

    const [data, totalCount] = await Promise.all([
      db
        .select({
          id: trsDocumentRequests.id,
          documentNumber: trsDocumentRequests.documentNumber,
          title: trsDocumentRequests.title,
          categoryName: mstCategories.name,
          requesterName: mstUsers.name,
          requesterEmail: mstUsers.email,
          currentStep: trsDocumentRequests.currentStep,
          totalSteps: trsDocumentRequests.totalSteps,
          submittedAt: trsDocumentRequests.createdAt,
          instanceStepId: approvalInstanceSteps.id,
          stepNumber: approvalSteps.step,
        })
        .from(approvalInstanceSteps)
        .innerJoin(approvalInstances, eq(approvalInstanceSteps.instanceId, approvalInstances.id))
        .innerJoin(approvalSteps, eq(approvalInstanceSteps.stepId, approvalSteps.id))
        .innerJoin(
          trsDocumentRequests,
          sql`${trsDocumentRequests.id}::varchar = ${approvalInstances.modelId}`
        )
        .innerJoin(mstCategories, eq(trsDocumentRequests.categoryId, mstCategories.id))
        .innerJoin(mstUsers, eq(trsDocumentRequests.userId, mstUsers.id))
        .where(baseCondition)
        .orderBy(asc(trsDocumentRequests.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db
        .select({ value: count() })
        .from(approvalInstanceSteps)
        .innerJoin(approvalInstances, eq(approvalInstanceSteps.instanceId, approvalInstances.id))
        .innerJoin(approvalSteps, eq(approvalInstanceSteps.stepId, approvalSteps.id))
        .innerJoin(
          trsDocumentRequests,
          sql`${trsDocumentRequests.id}::varchar = ${approvalInstances.modelId}`
        )
        .where(baseCondition),
    ])

    const total = Number(totalCount[0]?.value ?? 0)

    return {
      items: data.map((d) => ({
        id: Number(d.id),
        documentNumber: d.documentNumber,
        title: d.title,
        categoryName: d.categoryName,
        requesterName: d.requesterName,
        requesterEmail: d.requesterEmail,
        currentStep: Number(d.currentStep),
        totalSteps: Number(d.totalSteps),
        submittedAt: d.submittedAt ? new Date(d.submittedAt).toISOString() : '',
        instanceStepId: Number(d.instanceStepId),
        stepNumber: Number(d.stepNumber),
      })),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    }
  },

  /**
   * Eksekusi aksi Approve atau Reject dengan validasi ketat (Race Condition & Guard Prevention)
   */
  async processApprovalAction(
    requestId: number,
    userId: number,
    action: 'approve' | 'reject',
    comment?: string
  ) {
    return await db.transaction(async (tx) => {
      // 1. Ambil dokumen dan cek keberadaannya
      const [doc] = await tx
        .select()
        .from(trsDocumentRequests)
        .where(and(eq(trsDocumentRequests.id, requestId), isNull(trsDocumentRequests.deletedAt)))
        .limit(1)

      if (!doc) {
        throw new Error('Dokumen pengajuan tidak ditemukan')
      }

      // 2. GUARD: Dokumen sudah final (approved atau rejected)
      if (doc.status === 'approved' || doc.status === 'rejected') {
        throw new Error(`Aksi ditolak: Dokumen telah berstatus final (${doc.status})`)
      }

      // 3. GUARD: Self-Approval prevention
      if (Number(doc.userId) === userId) {
        throw new Error('Self-approval dilarang: Pemohon tidak boleh menyetujui pengajuannya sendiri')
      }

      // 4. Ambil approval instance terkait
      const [instance] = await tx
        .select()
        .from(approvalInstances)
        .where(
          and(
            eq(approvalInstances.modelType, 'document_request'),
            eq(approvalInstances.modelId, String(requestId))
          )
        )
        .limit(1)

      if (!instance || instance.status !== 'pending') {
        throw new Error('Status alur approval dokumen tidak dalam kondisi pending')
      }

      // 5. Cari instance step yang sedang aktif
      const activeStepRow = await tx
        .select({
          instanceStepId: approvalInstanceSteps.id,
          stepId: approvalInstanceSteps.stepId,
          stepNumber: approvalSteps.step,
          approverUserId: approvalInstanceSteps.approverUserId,
          status: approvalInstanceSteps.status,
        })
        .from(approvalInstanceSteps)
        .innerJoin(approvalSteps, eq(approvalInstanceSteps.stepId, approvalSteps.id))
        .where(
          and(
            eq(approvalInstanceSteps.instanceId, instance.id),
            eq(approvalSteps.step, instance.currentStep!)
          )
        )
        .limit(1)

      if (!activeStepRow || activeStepRow.length === 0) {
        throw new Error('Step approval aktif tidak ditemukan')
      }

      const activeStep = activeStepRow[0]

      // 6. GUARD: Hanya approver pada step aktif yang berhak memproses
      if (Number(activeStep.approverUserId) !== userId) {
        throw new Error('Aksi ditolak: Anda bukan approver yang ditugaskan pada step aktif saat ini')
      }

      // 7. GUARD: Pencegahan aksi ganda / race condition pada step yang sama
      if (activeStep.status !== 'pending') {
        throw new Error('Aksi ditolak: Step approval ini sudah diproses sebelumnya')
      }

      // 8. Eksekusi mutasi berdasarkan aksi
      const now = new Date()

      if (action === 'approve') {
        // Tandai step ini sebagai approved
        await tx
          .update(approvalInstanceSteps)
          .set({
            status: 'approved',
            approvedAt: now,
            notes: comment || 'Disetujui',
          })
          .where(eq(approvalInstanceSteps.id, activeStep.instanceStepId))

        // Catat ke approval_logs
        await tx.insert(approvalLogs).values({
          instanceStepId: activeStep.instanceStepId,
          action: 'approve',
          comment: comment || 'Disetujui',
        })

        const isLastStep = Number(instance.currentStep) >= Number(doc.totalSteps)

        if (isLastStep) {
          // Final Step: Ubah status instance dan dokumen menjadi approved
          await tx
            .update(approvalInstances)
            .set({ status: 'approved' })
            .where(eq(approvalInstances.id, instance.id))

          await tx
            .update(trsDocumentRequests)
            .set({ status: 'approved' })
            .where(eq(trsDocumentRequests.id, doc.id))
        } else {
          // Lanjut ke step berikutnya
          const nextStepNum = Number(instance.currentStep) + 1

          await tx
            .update(approvalInstances)
            .set({ currentStep: nextStepNum })
            .where(eq(approvalInstances.id, instance.id))

          await tx
            .update(trsDocumentRequests)
            .set({ currentStep: nextStepNum })
            .where(eq(trsDocumentRequests.id, doc.id))

          // Buka status step berikutnya menjadi 'pending'
          const nextStepRow = await tx
            .select({ id: approvalInstanceSteps.id })
            .from(approvalInstanceSteps)
            .innerJoin(approvalSteps, eq(approvalInstanceSteps.stepId, approvalSteps.id))
            .where(
              and(
                eq(approvalInstanceSteps.instanceId, instance.id),
                eq(approvalSteps.step, nextStepNum)
              )
            )
            .limit(1)

          if (nextStepRow && nextStepRow.length > 0) {
            await tx
              .update(approvalInstanceSteps)
              .set({ status: 'pending' })
              .where(eq(approvalInstanceSteps.id, nextStepRow[0].id))
          }
        }
      } else if (action === 'reject') {
        // GUARD: Reject wajib memberikan alasan
        if (!comment || comment.trim().length === 0) {
          throw new Error('Alasan penolakan (comment) wajib diisi saat menolak dokumen')
        }

        // Tandai step ini sebagai rejected
        await tx
          .update(approvalInstanceSteps)
          .set({
            status: 'rejected',
            notes: comment,
          })
          .where(eq(approvalInstanceSteps.id, activeStep.instanceStepId))

        // Catat ke approval_logs
        await tx.insert(approvalLogs).values({
          instanceStepId: activeStep.instanceStepId,
          action: 'reject',
          comment,
        })

        // Ubah status instance dan dokumen menjadi rejected
        await tx
          .update(approvalInstances)
          .set({ status: 'rejected' })
          .where(eq(approvalInstances.id, instance.id))

        await tx
          .update(trsDocumentRequests)
          .set({ status: 'rejected' })
          .where(eq(trsDocumentRequests.id, doc.id))
      }

      return { success: true, action, documentId: doc.id }
    })
  },
}
