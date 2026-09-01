// Augments the CloudflareEnv interface declared by @opennextjs/cloudflare
// with this app's bindings and secrets.
export {};

declare global {
  interface CloudflareEnv {
    DB: D1Database;

    // Auth
    SESSION_JWT_SECRET: string;

    // Microsoft Graph / SharePoint
    MS_TENANT_ID: string;
    MS_CLIENT_ID: string;
    MS_CLIENT_SECRET: string;
    // Used for auto-discovering document libraries (see
    // src/lib/msgraph/libraries.ts discoverLibraries) — the individual
    // libraries synced live in the sharepoint_libraries D1 table, not an
    // env var, since this firm's site has ~12 of them.
    MS_SHAREPOINT_SITE_ID: string;
    WEBHOOK_SHARED_SECRET: string;

    // Google Drive
    GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
    GOOGLE_IMPERSONATED_ADMIN_EMAIL: string;
    GOOGLE_DRIVE_ROOT_FOLDER_ID: string;

    APP_BASE_URL: string;
  }
}
