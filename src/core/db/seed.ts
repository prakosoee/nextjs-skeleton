import 'dotenv/config'
import { db, schema, isMysql } from './index'
import { hashPassword } from '@/src/core/auth/password'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('Seeding database...')

  // ─── RESET EXISTING DATA ─────────────────────────────────
  if (!isMysql) {
    await db.execute(sql`
      TRUNCATE TABLE 
        approval_logs, 
        approval_instance_steps, 
        approval_instances, 
        approval_steps, 
        cfg_category_workflows, 
        trs_document_requests, 
        approval_workflows, 
        mst_features, 
        trs_role_permissions, 
        trs_user_roles, 
        mst_permissions, 
        mst_roles, 
        mst_users, 
        mst_categories 
      RESTART IDENTITY CASCADE;
    `)
  }

  // ─── PERMISSIONS ────────────────────────────────────────
  await db.insert(schema.mstPermissions).values([
    { name: 'master-data.view', guardName: 'web', description: 'View master data' },
    { name: 'master-data.manage', guardName: 'web', description: 'Manage master data' },
    { name: 'user.view', guardName: 'web', description: 'View users' },
    { name: 'user.manage', guardName: 'web', description: 'Manage users' },
    { name: 'role.view', guardName: 'web', description: 'View roles' },
    { name: 'role.manage', guardName: 'web', description: 'Manage roles' },
    { name: 'permission.view', guardName: 'web', description: 'View permissions' },
    { name: 'configuration.approval-line.view', guardName: 'web', description: 'View approval line configuration' },
    { name: 'configuration.approval-line.manage', guardName: 'web', description: 'Manage approval line configuration' },
    { name: 'document-request.view', guardName: 'web', description: 'View document requests' },
    { name: 'document-request.manage', guardName: 'web', description: 'Submit and manage document requests' },
    { name: 'approval.review', guardName: 'web', description: 'Review and approve/reject requests' },
  ])
  const permissions = await db.query.mstPermissions.findMany()
  console.log(`  ${permissions.length} permissions created`)

  const permMap = Object.fromEntries(permissions.map(p => [p.name, p.id]))

  // ─── ROLES ──────────────────────────────────────────────
  await db.insert(schema.mstRoles).values([
    { name: 'super-admin', guardName: 'web', isSystem: true },
    { name: 'admin', guardName: 'web', isSystem: true },
    { name: 'staff', guardName: 'web', isSystem: false },
    { name: 'approver', guardName: 'web', isSystem: false },
    { name: 'viewer', guardName: 'web', isSystem: true },
  ])
  console.log('  5 roles created')

  const allRoles = await db.query.mstRoles.findMany()
  const roleMap = Object.fromEntries(allRoles.map(r => [r.name, r.id]))

  // ─── ROLE PERMISSIONS ───────────────────────────────────
  const rolePermValues = [
    // super-admin: all permissions
    ...permissions.map(p => ({ roleId: roleMap['super-admin'], permissionId: p.id })),

    // admin: manage master-data, user, role, configuration, document-request, approval
    { roleId: roleMap['admin'], permissionId: permMap['master-data.view'] },
    { roleId: roleMap['admin'], permissionId: permMap['master-data.manage'] },
    { roleId: roleMap['admin'], permissionId: permMap['user.view'] },
    { roleId: roleMap['admin'], permissionId: permMap['user.manage'] },
    { roleId: roleMap['admin'], permissionId: permMap['role.view'] },
    { roleId: roleMap['admin'], permissionId: permMap['role.manage'] },
    { roleId: roleMap['admin'], permissionId: permMap['permission.view'] },
    { roleId: roleMap['admin'], permissionId: permMap['configuration.approval-line.view'] },
    { roleId: roleMap['admin'], permissionId: permMap['configuration.approval-line.manage'] },
    { roleId: roleMap['admin'], permissionId: permMap['document-request.view'] },
    { roleId: roleMap['admin'], permissionId: permMap['document-request.manage'] },
    { roleId: roleMap['admin'], permissionId: permMap['approval.review'] },

    // staff: view & submit document request
    { roleId: roleMap['staff'], permissionId: permMap['document-request.view'] },
    { roleId: roleMap['staff'], permissionId: permMap['document-request.manage'] },

    // approver: review approval & view document request
    { roleId: roleMap['approver'], permissionId: permMap['approval.review'] },
    { roleId: roleMap['approver'], permissionId: permMap['document-request.view'] },

    // viewer: view only
    { roleId: roleMap['viewer'], permissionId: permMap['master-data.view'] },
    { roleId: roleMap['viewer'], permissionId: permMap['user.view'] },
    { roleId: roleMap['viewer'], permissionId: permMap['role.view'] },
    { roleId: roleMap['viewer'], permissionId: permMap['permission.view'] },
    { roleId: roleMap['viewer'], permissionId: permMap['document-request.view'] },
    { roleId: roleMap['viewer'], permissionId: permMap['configuration.approval-line.view'] },
  ]
  await db.insert(schema.trsRolePermissions).values(rolePermValues)
  console.log(`  ${rolePermValues.length} role permissions assigned`)

  // ─── USERS ──────────────────────────────────────────────
  const defaultPasswordHash = await hashPassword('password123')
  const adminHash = await hashPassword('admin123')
  const requesterHash = await hashPassword('requester123')
  const approverHash = await hashPassword('approver123')
  const viewerHash = await hashPassword('viewer123')

  await db.insert(schema.mstUsers).values([
    { username: 'admin', email: 'admin@skeleton.local', name: 'Super Admin', passwordHash: adminHash, isActive: true },
    { username: 'requester', email: 'requester@skeleton.local', name: 'Budi Requester', passwordHash: requesterHash, isActive: true },
    { username: 'approver1', email: 'approver1@skeleton.local', name: 'Siti Supervisor (Approver 1)', passwordHash: approverHash, isActive: true },
    { username: 'approver2', email: 'approver2@skeleton.local', name: 'Ahmad Manager (Approver 2)', passwordHash: approverHash, isActive: true },
    { username: 'approver3', email: 'approver3@skeleton.local', name: 'Hendra Director (Approver 3)', passwordHash: approverHash, isActive: true },
    { username: 'viewer', email: 'viewer@skeleton.local', name: 'Viewer User', passwordHash: viewerHash, isActive: true },
  ])
  const users = await db.query.mstUsers.findMany()
  const userMap = Object.fromEntries(users.map(u => [u.username, u]))
  console.log(`  ${users.length} users created`)

  // ─── USER ROLES ─────────────────────────────────────────
  await db.insert(schema.trsUserRoles).values([
    { userId: userMap['admin'].id, roleId: roleMap['super-admin'] },
    { userId: userMap['requester'].id, roleId: roleMap['staff'] },
    { userId: userMap['approver1'].id, roleId: roleMap['approver'] },
    { userId: userMap['approver2'].id, roleId: roleMap['approver'] },
    { userId: userMap['approver3'].id, roleId: roleMap['approver'] },
    { userId: userMap['viewer'].id, roleId: roleMap['viewer'] },
  ])
  console.log('  User roles assigned')

  // ─── CATEGORIES ─────────────────────────────────────────
  await db.insert(schema.mstCategories).values([
    { code: 'SOP-IT', name: 'Teknologi Informasi', description: 'Dokumen SOP IT (Alur Approval 3-Step: Supervisor -> Manager -> Director)', isActive: true },
    { code: 'SOP-FIN', name: 'Keuangan & Pajak', description: 'Dokumen SOP Finansial (Alur Approval 2-Step: Reviewer -> Manager)', isActive: true },
    { code: 'SOP-HR', name: 'Sumber Daya Manusia', description: 'Dokumen SOP Kepegawaian & SDM', isActive: true },
  ])
  const categories = await db.query.mstCategories.findMany()
  const catMap = Object.fromEntries(categories.map(c => [c.code, c]))
  console.log(`  ${categories.length} categories created`)

  // ─── FEATURES ───────────────────────────────────────────
  await db.insert(schema.mstFeatures).values([
    { code: 'DASHBOARD', name: 'Dashboard', routePath: '/dashboard', icon: 'LayoutDashboard', sortOrder: 0, parentId: null },
  ])
  const dashboardFeature = await db.query.mstFeatures.findFirst({
    where: (f, { eq }) => eq(f.code, 'DASHBOARD'),
  })

  await db.insert(schema.mstFeatures).values([
    { code: 'DOCUMENT_REQUEST', name: 'Document Request', routePath: '/dashboard/document-request', icon: 'FileText', sortOrder: 1, parentId: dashboardFeature!.id },
    { code: 'APPROVAL_INBOX', name: 'Approval Inbox', routePath: '/dashboard/document-request/inbox', icon: 'Inbox', sortOrder: 2, parentId: dashboardFeature!.id },
    { code: 'CATEGORY', name: 'Category', routePath: '/dashboard/master-data/category', icon: 'FolderTree', sortOrder: 3, parentId: dashboardFeature!.id },
    { code: 'USER', name: 'Users', routePath: '/dashboard/user-management/user', icon: 'Users', sortOrder: 4, parentId: dashboardFeature!.id },
    { code: 'ROLE', name: 'Roles', routePath: '/dashboard/user-management/role', icon: 'Shield', sortOrder: 5, parentId: dashboardFeature!.id },
    { code: 'PERMISSION', name: 'Permissions', routePath: '/dashboard/user-management/permission', icon: 'KeyRound', sortOrder: 6, parentId: dashboardFeature!.id },
    { code: 'APPROVAL_LINE', name: 'Approval Lines', routePath: '/dashboard/configuration/approval-line', icon: 'GitBranch', sortOrder: 7, parentId: dashboardFeature!.id },
  ])
  const docFeature = await db.query.mstFeatures.findFirst({
    where: (f, { eq }) => eq(f.code, 'DOCUMENT_REQUEST'),
  })
  console.log('  Features created')

  // ─── APPROVAL WORKFLOWS ─────────────────────────────────
  // Workflow 1: 3 Steps untuk Kategori IT
  await db.insert(schema.approvalWorkflows).values([
    { featureId: docFeature!.id, name: 'SOP IT Approval Line (3 Steps)', isActive: true },
    { featureId: docFeature!.id, name: 'SOP Finance Approval Line (2 Steps)', isActive: true },
  ])
  const workflows = await db.query.approvalWorkflows.findMany()
  const wfIt = workflows.find(w => w.name.includes('3 Steps'))!
  const wfFin = workflows.find(w => w.name.includes('2 Steps'))!

  // Steps untuk Workflow IT (3 Steps)
  await db.insert(schema.approvalSteps).values([
    { workflowId: wfIt.id, step: 1, groupNo: 1, code: 'STEP-1-SPV', approverType: 'user', userId: userMap['approver1'].id, groupType: 'SEQUENTIAL', minApproval: 1, isRequired: true, allowedActions: 'approve,reject' },
    { workflowId: wfIt.id, step: 2, groupNo: 1, code: 'STEP-2-MGR', approverType: 'user', userId: userMap['approver2'].id, groupType: 'SEQUENTIAL', minApproval: 1, isRequired: true, allowedActions: 'approve,reject' },
    { workflowId: wfIt.id, step: 3, groupNo: 1, code: 'STEP-3-DIR', approverType: 'user', userId: userMap['approver3'].id, groupType: 'SEQUENTIAL', minApproval: 1, isRequired: true, allowedActions: 'approve,reject' },
  ])

  // Steps untuk Workflow Finance (2 Steps)
  await db.insert(schema.approvalSteps).values([
    { workflowId: wfFin.id, step: 1, groupNo: 1, code: 'STEP-1-REV', approverType: 'user', userId: userMap['approver1'].id, groupType: 'SEQUENTIAL', minApproval: 1, isRequired: true, allowedActions: 'approve,reject' },
    { workflowId: wfFin.id, step: 2, groupNo: 1, code: 'STEP-2-MGR', approverType: 'user', userId: userMap['approver2'].id, groupType: 'SEQUENTIAL', minApproval: 1, isRequired: true, allowedActions: 'approve,reject' },
  ])
  console.log('  Approval workflows and steps created')

  // ─── CATEGORY TO WORKFLOW MAPPINGS ──────────────────────
  await db.insert(schema.cfgCategoryWorkflows).values([
    { categoryId: catMap['SOP-IT'].id, workflowId: wfIt.id },
    { categoryId: catMap['SOP-FIN'].id, workflowId: wfFin.id },
  ])
  console.log('  Category to workflow mappings created')

  console.log('\nSeed completed successfully!')
  console.log('  Credentials:')
  console.log('  - Super Admin: admin / admin123 (full access)')
  console.log('  - Requester:   requester / requester123 (create & view requests)')
  console.log('  - Approver 1:  approver1 / approver123 (Step 1 review)')
  console.log('  - Approver 2:  approver2 / approver123 (Step 2 review)')
  console.log('  - Approver 3:  approver3 / approver123 (Step 3 review)')
  console.log('  - Viewer:      viewer / viewer123 (view only)')
}

main().catch(console.error)
