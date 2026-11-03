import {
  mysqlTable,
  serial,
  bigint,
  varchar,
  text,
  timestamp,
  int,
} from 'drizzle-orm/mysql-core'
import { relations } from 'drizzle-orm'
import { mstCategories, mstUsers } from './index'
import { approvalWorkflows } from './approval'

// ─── TRANSAKSI DOCUMENT REQUEST ────────────────────────────────
export const trsDocumentRequests = mysqlTable('trs_document_requests', {
  id: serial('id').primaryKey(),
  documentNumber: varchar('document_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  categoryId: bigint('category_id', { mode: 'number', unsigned: true }).notNull().references(() => mstCategories.id),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull().references(() => mstUsers.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  currentStep: int('current_step').notNull().default(1),
  totalSteps: int('total_steps').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at'),
})

// ─── MAPPING CATEGORY KE APPROVAL WORKFLOW ──────────────────────
export const cfgCategoryWorkflows = mysqlTable('cfg_category_workflows', {
  id: serial('id').primaryKey(),
  categoryId: bigint('category_id', { mode: 'number', unsigned: true }).notNull().unique().references(() => mstCategories.id),
  workflowId: bigint('workflow_id', { mode: 'number', unsigned: true }).notNull().references(() => approvalWorkflows.id),
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── RELATIONS ──────────────────────────────────────────────────
export const trsDocumentRequestsRelations = relations(trsDocumentRequests, ({ one }) => ({
  category: one(mstCategories, { fields: [trsDocumentRequests.categoryId], references: [mstCategories.id] }),
  user: one(mstUsers, { fields: [trsDocumentRequests.userId], references: [mstUsers.id] }),
}))

export const cfgCategoryWorkflowsRelations = relations(cfgCategoryWorkflows, ({ one }) => ({
  category: one(mstCategories, { fields: [cfgCategoryWorkflows.categoryId], references: [mstCategories.id] }),
  workflow: one(approvalWorkflows, { fields: [cfgCategoryWorkflows.workflowId], references: [approvalWorkflows.id] }),
}))

// ─── TYPE EXPORTS ───────────────────────────────────────────────
export type TrsDocumentRequest = typeof trsDocumentRequests.$inferSelect
export type NewTrsDocumentRequest = typeof trsDocumentRequests.$inferInsert

export type CfgCategoryWorkflow = typeof cfgCategoryWorkflows.$inferSelect
export type NewCfgCategoryWorkflow = typeof cfgCategoryWorkflows.$inferInsert

