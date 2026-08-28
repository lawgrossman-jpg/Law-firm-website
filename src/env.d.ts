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
    MS_SHAREPOINT_SITE_ID: string;
    MS_SHAREPOINT_DRIVE_ID: string;
    WEBHOOK_SHARED_SECRET: string;

    // Google Drive
    GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
    GOOGLE_IMPERSONATED_ADMIN_EMAIL: string;
    GOOGLE_DRIVE_ROOT_FOLDER_ID: string;

    APP_BASE_URL: string;
  }
}
