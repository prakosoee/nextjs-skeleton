import type { DocumentRequest, ApprovalInboxItem } from './document-request.entity'

export interface DocumentRequestList {
  items: DocumentRequest[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export interface ApprovalInboxList {
  items: ApprovalInboxItem[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

