export type DocumentRequestStatus = 'pending' | 'approved' | 'rejected'

export interface DocumentRequest {
  id: number
  documentNumber: string
  title: string
  description: string | null
  categoryId: number
  categoryName?: string
  categoryCode?: string | null
  userId: number
  requesterName?: string
  requesterEmail?: string
  status: DocumentRequestStatus
  currentStep: number
  totalSteps: number
  createdAt: string
  updatedAt: string
}

export interface ApprovalStepSnapshot {
  id: number
  instanceId: number
  stepId: number
  stepNumber: number
  approverUserId: number
  approverName: string
  approverEmail?: string
  status: 'pending' | 'approved' | 'rejected' | 'waiting'
  approvedAt: string | null
  notes: string | null
  createdAt: string
}

export interface ApprovalAuditLog {
  id: number
  instanceStepId: number
  stepNumber: number
  actorName: string
  action: 'submit' | 'approve' | 'reject'
  comment: string | null
  createdAt: string
}

export interface DocumentRequestDetail extends DocumentRequest {
  workflowName?: string
  steps: ApprovalStepSnapshot[]
  currentApprover?: {
    id: number
    name: string
    email?: string
    stepNumber: number
  } | null
  timeline: ApprovalAuditLog[]
}

export interface ApprovalInboxItem {
  id: number // trs_document_requests.id
  documentNumber: string
  title: string
  categoryName: string
  requesterName: string
  requesterEmail: string
  currentStep: number
  totalSteps: number
  submittedAt: string
  instanceStepId: number // ID step aktif yang harus diproses
  stepNumber: number
}

