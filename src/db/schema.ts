import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

// ---------------------------------------------------------------------------
// Employees / auth / RBAC
// ---------------------------------------------------------------------------

// שותף (partner) | שכיר (associate) | מתמחה (intern) | מזכירות (secretary) | אדמין (admin)
export const employeeRoles = [
  "partner",
  "associate",
  "intern",
  "secretary",
  "admin",
] as const;
export type EmployeeRole = (typeof employeeRoles)[number];

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<EmployeeRole>().notNull().default("associate"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

// Maps an internal employee to their Microsoft 365 and Google Workspace
// identities so file edits made in either cloud can be attributed correctly.
export const userIdentityMap = sqliteTable(
  "user_identity_map",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    msUserId: text("ms_user_id"),
    msUserPrincipalName: text("ms_user_principal_name"),
    googleUserId: text("google_user_id"),
    googleEmail: text("google_email"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_identity_employee_idx").on(t.employeeId),
    index("user_identity_ms_idx").on(t.msUserId),
    index("user_identity_google_idx").on(t.googleUserId),
  ],
);

// ---------------------------------------------------------------------------
// Clients / cases
// ---------------------------------------------------------------------------

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  idNumber: text("id_number"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  ...timestamps,
});

// Defines the standard folder tree + task schedule auto-provisioned for a
// new case of this type (e.g. "תביעה אזרחית", "הוצאה לפועל").
export const caseTypes = sqliteTable("case_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // JSON string[]: relative sub-folder paths created under the case root.
  folderTemplate: text("folder_template", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  // JSON array of { title, description, dueOffsetDays, assigneeRole } used
  // to auto-generate scheduled tasks when a case of this type is opened.
  taskTemplate: text("task_template", { mode: "json" })
    .$type<
      Array<{
        title: string;
        description?: string;
        dueOffsetDays: number;
        assigneeRole?: EmployeeRole;
      }>
    >()
    .notNull(),
  ...timestamps,
});

export const caseStatuses = ["open", "on_hold", "closed"] as const;
export type CaseStatus = (typeof caseStatuses)[number];

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    caseNumber: text("case_number").notNull().unique(),
    title: text("title").notNull(),
    caseTypeId: text("case_type_id").references(() => caseTypes.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    courtCaseNumber: text("court_case_number"),
    opposingParty: text("opposing_party"),
    status: text("status").$type<CaseStatus>().notNull().default("open"),
    responsibleEmployeeId: text("responsible_employee_id").references(
      () => employees.id,
    ),
    // Which SharePoint library (drive) this case's folder lives in —
    // normally the primary case library (e.g. "תיקים פתוחים").
    sharepointLibraryId: text("sharepoint_library_id"),
    // Root folder path relative to the shared Google Drive root, prefixed
    // with the library name, e.g. "תיקים פתוחים/2026-014-Cohen". The path
    // relative to the SharePoint library's own root is this with the
    // library-name prefix stripped.
    folderPath: text("folder_path").notNull(),
    sharepointFolderItemId: text("sharepoint_folder_item_id"),
    driveFolderId: text("drive_folder_id"),
    notes: text("notes"),
    openedAt: text("opened_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    closedAt: text("closed_at"),
    ...timestamps,
  },
  (t) => [
    index("cases_client_idx").on(t.clientId),
    index("cases_status_idx").on(t.status),
  ],
);

// Parties on a case (plaintiff/defendant/etc) used as merge-field sources
// for the document generator (יפוי כוח, כתבי טענות, ...).
export const casePartyRoles = [
  "plaintiff",
  "defendant",
  "client",
  "opposing_counsel",
  "other",
] as const;
export type CasePartyRole = (typeof casePartyRoles)[number];

export const caseParties = sqliteTable(
  "case_parties",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    role: text("role").$type<CasePartyRole>().notNull(),
    fullName: text("full_name").notNull(),
    idNumber: text("id_number"),
    address: text("address"),
    phone: text("phone"),
    ...timestamps,
  },
  (t) => [index("case_parties_case_idx").on(t.caseId)],
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const taskStatuses = ["pending", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskPriorities = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").references(() => cases.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: text("due_date"),
    assignedToId: text("assigned_to_id").references(() => employees.id),
    status: text("status").$type<TaskStatus>().notNull().default("pending"),
    priority: text("priority")
      .$type<TaskPriority>()
      .notNull()
      .default("normal"),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (t) => [
    index("tasks_case_idx").on(t.caseId),
    index("tasks_assignee_idx").on(t.assignedToId),
    index("tasks_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Documents / document generator
// ---------------------------------------------------------------------------

export const documentSources = [
  "manual_upload",
  "scanner",
  "email",
  "generated",
  "migrated",
] as const;
export type DocumentSource = (typeof documentSources)[number];

// Which cloud currently holds the authoritative copy of a file.
export const storageProviders = ["sharepoint", "drive"] as const;
export type StorageProvider = (typeof storageProviders)[number];

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Path relative to the case root folder, e.g. "כתבי טענות/תביעה.docx".
    relativePath: text("relative_path").notNull(),
    primaryProvider: text("primary_provider")
      .$type<StorageProvider>()
      .notNull()
      .default("sharepoint"),
    sharepointItemId: text("sharepoint_item_id"),
    sharepointETag: text("sharepoint_etag"),
    driveFileId: text("drive_file_id"),
    driveMd5: text("drive_md5"),
    contentHash: text("content_hash"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    source: text("source").$type<DocumentSource>().notNull(),
    version: integer("version").notNull().default(1),
    createdByEmployeeId: text("created_by_employee_id").references(
      () => employees.id,
    ),
    lastModifiedByEmployeeId: text("last_modified_by_employee_id").references(
      () => employees.id,
    ),
    lastModifiedAt: text("last_modified_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    ...timestamps,
  },
  (t) => [
    index("documents_case_idx").on(t.caseId),
    uniqueIndex("documents_sharepoint_item_idx").on(t.sharepointItemId),
    uniqueIndex("documents_drive_file_idx").on(t.driveFileId),
  ],
);

export const documentTemplates = sqliteTable("document_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  // Base64-encoded .docx template (small legal templates only; large binary
  // assets should live in SharePoint/Drive, not D1).
  docxBase64: text("docx_base64").notNull(),
  // JSON string[] of placeholder tags used by the template, e.g.
  // ["client.fullName", "client.idNumber", "case.courtCaseNumber"].
  placeholders: text("placeholders", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const auditActions = [
  "login",
  "logout",
  "case.create",
  "case.update",
  "case.close",
  "task.create",
  "task.update",
  "task.complete",
  "document.upload",
  "document.scan",
  "document.download",
  "document.view",
  "document.generate",
  "document.delete",
  "document.sync_update",
  "employee.create",
  "employee.update",
  "sync.conflict",
  "sync.migration_run",
  "sync.library_update",
] as const;
export type AuditAction = (typeof auditActions)[number];

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").references(() => employees.id),
    // Free-text label used when an action is attributed to a cloud identity
    // (SharePoint/Drive editor) that isn't a logged-in app session.
    actorLabel: text("actor_label"),
    action: text("action").$type<AuditAction>().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    ...timestamps,
  },
  (t) => [
    index("audit_log_employee_idx").on(t.employeeId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// SharePoint <-> Google Drive sync
// ---------------------------------------------------------------------------

// One row per SharePoint document library (drive) on the firm's site —
// this site has ~12 libraries (תיקים פתוחים, תיקים סגורים, פסיקה, ...), all
// synced in parallel. Each becomes a top-level folder (named `name`) under
// the shared Google Drive root. `isPrimaryForCases` marks the single
// library new case folders are auto-provisioned into (see
// src/lib/cases/provision.ts) — normally "תיקים פתוחים".
export const sharepointLibraries = sqliteTable(
  "sharepoint_libraries",
  {
    id: text("id").primaryKey(),
    driveId: text("drive_id").notNull(),
    name: text("name").notNull(),
    isPrimaryForCases: integer("is_primary_for_cases", { mode: "boolean" })
      .notNull()
      .default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("sharepoint_libraries_drive_idx").on(t.driveId)],
);

export const syncItemTypes = ["file", "folder"] as const;
export type SyncItemType = (typeof syncItemTypes)[number];

export const syncDirections = ["sp_to_drive", "drive_to_sp", "initial_migration"] as const;
export type SyncDirection = (typeof syncDirections)[number];

// One row per mirrored file/folder, tracking both sides' identifiers and
// content hashes so the sync engine can detect changes and conflicts.
export const syncMappings = sqliteTable(
  "sync_mappings",
  {
    id: text("id").primaryKey(),
    itemType: text("item_type").$type<SyncItemType>().notNull(),
    // Path relative to the shared Google Drive root, prefixed with the
    // owning library's name (e.g. "תיקים פתוחים/2026-014-Cohen/..."),
    // identical on both sides when in sync.
    relativePath: text("relative_path").notNull(),
    // Which SharePoint library (drive) this item lives in — needed to
    // scope any Graph API call back to the right drive.
    sharepointDriveId: text("sharepoint_drive_id"),
    sharepointItemId: text("sharepoint_item_id"),
    sharepointETag: text("sharepoint_etag"),
    sharepointHash: text("sharepoint_hash"),
    driveFileId: text("drive_file_id"),
    driveMd5: text("drive_md5"),
    lastSyncedAt: text("last_synced_at"),
    lastSyncDirection: text("last_sync_direction").$type<SyncDirection>(),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sync_mappings_path_idx").on(t.relativePath),
    uniqueIndex("sync_mappings_sp_item_idx").on(t.sharepointItemId),
    uniqueIndex("sync_mappings_drive_file_idx").on(t.driveFileId),
  ],
);

export const syncConflicts = sqliteTable(
  "sync_conflicts",
  {
    id: text("id").primaryKey(),
    syncMappingId: text("sync_mapping_id")
      .notNull()
      .references(() => syncMappings.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    sharepointHashAtConflict: text("sharepoint_hash_at_conflict"),
    driveHashAtConflict: text("drive_hash_at_conflict"),
    resolution: text("resolution"),
    resolvedAt: text("resolved_at"),
    ...timestamps,
  },
  (t) => [index("sync_conflicts_mapping_idx").on(t.syncMappingId)],
);

// Active Microsoft Graph / Google Drive webhook (push notification)
// subscriptions, which expire and must be renewed on a cron schedule.
export const webhookProviders = ["graph", "drive"] as const;
export type WebhookProvider = (typeof webhookProviders)[number];

// Small key-value store for sync cursors (Graph delta link, Drive
// startPageToken) that must survive across webhook invocations.
export const syncCursors = sqliteTable("sync_cursors", {
  id: text("id").primaryKey(), // "graph_delta_link" | "drive_page_token"
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const webhookSubscriptions = sqliteTable(
  "webhook_subscriptions",
  {
    id: text("id").primaryKey(),
    provider: text("provider").$type<WebhookProvider>().notNull(),
    subscriptionId: text("subscription_id").notNull(),
    resourceUri: text("resource_uri").notNull(),
    // For provider="graph": which library (drive) this subscription
    // watches — one row per enabled library. Unused for provider="drive"
    // (a single shared channel covers the whole Google Drive account).
    sharepointDriveId: text("sharepoint_drive_id"),
    // Drive push notification channels additionally need a resource ID.
    driveResourceId: text("drive_resource_id"),
    expirationDateTime: text("expiration_date_time").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("webhook_subscriptions_drive_idx").on(t.sharepointDriveId)],
);

// ---------------------------------------------------------------------------
// Phase-2 stub tables (schema ready, integrations not yet implemented):
// government systems (Net HaMishpat / Hotzaa LaPoal / Bituach Leumi) and
// financial sync (Green Invoice / Morning). See README "Phase 2".
// ---------------------------------------------------------------------------

export const govSources = ["net_hamishpat", "hotzaa_lapoal", "bituach_leumi"] as const;
export type GovSource = (typeof govSources)[number];

export const govCaseUpdates = sqliteTable(
  "gov_case_updates",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    source: text("source").$type<GovSource>().notNull(),
    externalId: text("external_id"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    receivedAt: text("received_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("gov_case_updates_case_idx").on(t.caseId)],
);

export const financialSources = ["green_invoice", "morning"] as const;
export type FinancialSource = (typeof financialSources)[number];

export const financialTransactionTypes = ["invoice", "receipt", "expense"] as const;
export type FinancialTransactionType = (typeof financialTransactionTypes)[number];

export const financialTransactions = sqliteTable(
  "financial_transactions",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").references(() => cases.id, {
      onDelete: "set null",
    }),
    type: text("type").$type<FinancialTransactionType>().notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("ILS"),
    source: text("source").$type<FinancialSource>().notNull(),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [index("financial_transactions_case_idx").on(t.caseId)],
);
