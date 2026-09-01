# מערכת ניהול משרד עורכי דין

Next.js (App Router) + TypeScript, פרוס על Cloudflare Workers, עם Cloudflare D1
(SQLite חינמי) כמסד הנתונים ו-Drizzle ORM. כולל ניהול תיקים/משימות, מחולל
מסמכים, וסנכרון דו-כיווני בזמן אמת בין SharePoint ל-Google Drive.

## מה כבר בנוי (Phase 1)

- **ניהול תיקים ומשימות** — יצירת תיק מייצרת אוטומטית עץ תיקיות (לפי סוג תיק)
  ורשימת משימות מתוזמנות עם תאריכי יעד ואחראים (`src/lib/cases`).
- **מחולל מסמכים** — יפוי כוח / כתב תביעה, עם מילוי אוטומטי מתוך רשומת התיק
  (`src/lib/docgen`). ניתן להוסיף תבניות נוספות (ראו למטה).
- **סנכרון דו-כיווני SharePoint ↔ Google Drive בזמן אמת**, כולל:
  - הגירה חד-פעמית של כל עץ הקבצים הקיים (`src/lib/sync/migration.ts`).
  - Webhooks משני הצדדים (Microsoft Graph change notifications + Google
    Drive push notifications) שמריצים סנכרון דלתא כמעט מיידי.
  - ניהול קונפליקטים: כל קובץ נשמר עם hash; אם שני הצדדים השתנו במקביל,
    המערכת לא דורסת — היא שומרת עותק מתנגש בנפרד ורושמת זאת (`sync_conflicts`).
  - מיפוי זהויות (Admin > עובדים): קישור בין חשבון Microsoft 365 לחשבון
    Google Workspace של כל עובד, כך שעריכת קובץ ב-SharePoint מיוחסת נכון
    ל"עובד X" גם ביומן האירועים וגם כ"נערך על ידי" בפועל ב-Drive (בעזרת
    האצלת הרשאות ברמת הדומיין, domain-wide delegation).
- **יומן אירועים (Audit Log)** מלא — כל פעולה (יצירת תיק, מחיקת מסמך, סריקה,
  הורדה, צפייה, סנכרון) נרשמת עם חותמת זמן ושם העובד.
- **צפייה/הורדה ישירה מהדפדפן** לכל מסמך — בלי לצאת ל-SharePoint/Drive.
- **הרשאות (RBAC)**: שותף / עו״ד שכיר / מתמחה / מזכירות / מנהל מערכת.

## מה עדיין לא בנוי (Phase 2)

הסכימה במסד הנתונים כבר כוללת טבלאות מוכנות (`gov_case_updates`,
`financial_transactions`) לשלב הבא, אך האינטגרציות עצמן טרם מומשו — הן
דורשות הסכמים/אישורים/מפתחות מול גורמים חיצוניים שרק בעל המשרד יכול להשיג:

- חיבור API/RPA לנט המשפט, הוצאה לפועל וביטוח לאומי.
- סנכרון דו-כיווני עם חשבונית ירוקה / Morning (הנהלת חשבונות).
- איסוף אוטומטי מבוסס כללים מהמייל (Outlook/Gmail) ומהמחשב.
- דרייבר סריקה TWAIN/WIA מובנה (דפדפן לא יכול לגשת ישירות לסורק — צריך
  אפליקציית עזר מקומית קטנה, או להשתמש בסריקה-למייל/לתיקייה קיימת שהמערכת
  כבר תאסוף אוטומטית).
- דו״ח דיווח יומי במייל — הנתונים (מסמך/תיק/נתיב/מקור) כבר נרשמים ב-`documents`
  וב-`audit_log`, חסר רק job יומי ששולח מייל מרוכז (בסיס דומה ל-`cron-worker/`).

---

## ארכיטקטורה

```
Next.js App Router  →  @opennextjs/cloudflare  →  Cloudflare Workers
                                                         │
                                          ┌──────────────┼───────────────┐
                                          ▼                              ▼
                                    Cloudflare D1                 Microsoft Graph API
                                 (SQLite, Drizzle ORM)              (SharePoint)
                                          │                              │
                                          │                              ▼
                                          │                    Google Drive API
                                          │                    (service account +
                                          │                     domain-wide delegation)
                                          ▼
                              cron-worker/ (Cron Trigger)
                         מחדש webhook subscriptions + מריץ
                              poll fallback כל שעה
```

כל הלוגיקה העסקית רצה כ-Server Actions / Route Handlers בתוך ה-Worker היחיד
של האפליקציה. `cron-worker/` הוא Worker נפרד וזעיר, כי ה-Worker הראשי (שנבנה
ע״י OpenNext) לא חושף `scheduled` handler משלו.

---

## הרצה מקומית

```bash
npm install
cp .dev.vars.example .dev.vars   # ומלאו את הסודות (ראו למטה)
npm run db:migrate:local          # יוצר את הסכמה + זורע נתוני התחלה
npm run dev
```

התחברות ראשונית: `admin@example.com` / `ChangeMe123!` — **החליפו סיסמה זו
מיד** (Admin > עובדים), או ערכו את ה-hash ב-`drizzle/seed.sql` לפני זריעה
בסביבת ייצור.

> `next.config.ts` קורא ל-`initOpenNextCloudflareForDev()`, כך ש-`next dev`
> הרגיל מקבל גישה אמיתית ל-D1 המקומי (ולא רק ל-mock).

### תבניות מסמכים

תבניות ה-docx (יפוי כוח, כתב תביעה) נוצרות מראש ונמצאות מקודדות ב-
`drizzle/seed_templates.sql`. כדי לשנות אותן או להוסיף חדשות, ערכו את
`scripts/generate-templates.mjs` (משתמש בחבילת `docx`) והריצו:

```bash
npm run templates:generate   # מייצר drizzle/templates/*.docx + מעדכן seed_templates.sql
```

תגי המיזוג הנתמכים (תחביר `{tag}` של docxtemplater) מוגדרים ב-
`src/lib/docgen/fieldMapper.ts`.

---

## פריסה ל-Cloudflare

### 1. Cloudflare D1 (מסד הנתונים החינמי)

```bash
npx wrangler login
npx wrangler d1 create law-firm-db
```

העתיקו את ה-`database_id` שמוחזר לתוך `wrangler.toml` (`database_id = "..."`).

```bash
npm run db:migrate:remote     # יוצר סכמה + זורע נתוני התחלה בענן
```

### 2. Azure AD (SharePoint / Microsoft Graph)

1. ב-[portal.azure.com](https://portal.azure.com) → Azure Active Directory →
   App registrations → **New registration**.
2. תחת **API permissions** הוסיפו הרשאות **Application** (לא Delegated):
   `Sites.ReadWrite.All`, `Files.ReadWrite.All`, `User.Read.All` — ולחצו
   **Grant admin consent**.
3. תחת **Certificates & secrets** צרו **Client secret** חדש.
4. אתרו את ה-Site ID של אתר ה-SharePoint (דרך
   [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)):
   ```
   GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{site-name}
   ```
   האתר יכול להכיל **כמה ספריות מסמכים** (לא רק אחת) — הן מנוהלות בטבלת
   `sharepoint_libraries` ב-D1, לא בהגדרות סביבה. סעיף 4 למטה מסביר איך
   לזרוע אותן (או להשתמש בגילוי האוטומטי דרך `/admin/sync`).
5. הגדירו את הסודות:
   ```bash
   npx wrangler secret put MS_TENANT_ID
   npx wrangler secret put MS_CLIENT_ID
   npx wrangler secret put MS_CLIENT_SECRET
   npx wrangler secret put MS_SHAREPOINT_SITE_ID
   ```

### 3. Google Cloud (Google Drive, Workspace domain-wide delegation)

1. ב-[console.cloud.google.com](https://console.cloud.google.com) צרו פרויקט,
   הפעילו **Google Drive API**.
2. צרו **Service Account** (IAM & Admin → Service Accounts), וייצרו לו מפתח
   JSON.
3. ב-[admin.google.com](https://admin.google.com) (כאדמין של ה-Workspace) →
   Security → API Controls → Domain-wide Delegation → **Add new**, הזינו את
   ה-Client ID של חשבון השירות עם ה-scope:
   `https://www.googleapis.com/auth/drive`
   (זה מה שמאפשר להתחזות לעובדים ספציפיים כדי לשמר קרדיט על עריכות — ראו
   `src/lib/googledrive/token.ts`).
4. צרו תיקיית שורש ב-Drive לגיבוי/מירור, ושתפו אותה עם חשבון השירות (או עם
   משתמש אדמין מוטמע), ואתרו את ה-folder id מה-URL.
5. הגדירו את הסודות:
   ```bash
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   # כולל \n בתוך המחרוזת, כמו בקובץ ה-JSON
   npx wrangler secret put GOOGLE_IMPERSONATED_ADMIN_EMAIL       # ברירת מחדל כשאין מיפוי עובד ספציפי
   npx wrangler secret put GOOGLE_DRIVE_ROOT_FOLDER_ID
   ```

### 4. סודות כלליים

```bash
npx wrangler secret put SESSION_JWT_SECRET      # מחרוזת אקראית ארוכה
npx wrangler secret put WEBHOOK_SHARED_SECRET   # מחרוזת אקראית — מאמתת webhooks נכנסים
```

עדכנו גם את `APP_BASE_URL` תחת `[vars]` ב-`wrangler.toml` לכתובת הפרוסה
בפועל (למשל `https://law-firm-management.<subdomain>.workers.dev`).

### 5. פריסת האפליקציה

```bash
npm run cf:build
npm run cf:deploy
```

### 6. Cron Worker לחידוש Webhooks

מנויי ה-webhook (Microsoft Graph ~3 ימים, Google Drive ~24 שעות) חייבים
להתחדש לפני שפגים. `cron-worker/` הוא Worker נפרד וזעיר עם Cron Trigger
שעתי שקורא ל-`/api/cron/tick`:

```bash
cd cron-worker
# ערכו את APP_BASE_URL ב-wrangler.toml לכתובת האפליקציה הראשית
npx wrangler secret put CRON_SECRET   # אותו ערך כמו WEBHOOK_SHARED_SECRET
npx wrangler deploy
```

לחלופין: כל מתזמן חיצוני (GitHub Actions scheduled workflow,
cron-job.org וכו׳) שמבצע `POST` ל-`https://<your-app>/api/cron/tick` עם
header `x-cron-secret: <WEBHOOK_SHARED_SECRET>` פעם בשעה — עובד באותה מידה.

### 7. הפעלת הסנכרון בפועל

לאחר שהכל פרוס והסודות מוגדרים:

1. ודאו שטבלת `sharepoint_libraries` מכילה את ספריות המסמכים של האתר —
   `drizzle/seed_sharepoint_libraries.sql` כבר מכיל את כל הספריות הקיימות
   (עם "תיקים פתוחים" מסומנת כספרייה הראשית לתיקים חדשים), ונטען אוטומטית
   ע"י `npm run db:migrate:remote`/`db:migrate:local`. ספרייה חדשה
   שתיווצר ב-SharePoint בעתיד תתגלה אוטומטית (ראו סעיף הבא) — או דרך
   הכפתור **גילוי ספריות** ב-Admin > סנכרון.
2. הריצו `POST /api/cron/tick` פעם אחת ידנית (או המתינו לטריגר הראשון) —
   זה מגלה ספריות חדשות ויוצר את מנויי ה-webhook (אחד לכל ספרייה).
3. ב-Admin > סנכרון, לחצו **הרצת הגירה מלאה** — מעתיקה את כל העץ הקיים
   מכל הספריות הפעילות ל-Drive, כל ספרייה כתיקייה נפרדת בשורש (ריצה
   חד-פעמית; ניתן להריץ שוב בבטחה במקרה כשל חלקי).
4. מכאן ואילך, כל שינוי בכל אחד מהצדדים מסונכרן כמעט מיידית דרך ה-webhooks,
   עם fallback של poll שעתי דרך ה-cron — שגם בודק בכל הרצה אם נוספו
   ספריות חדשות באתר.

---

## מבנה הפרויקט (עיקרי)

```
src/db/schema.ts              סכמת Drizzle המלאה (כל הטבלאות, כולל Phase 2)
src/lib/auth/                 session (JWT ב-cookie), סיסמאות, RBAC
src/lib/audit.ts              רישום יומן אירועים
src/lib/cases/                מספור תיקים, יצירת תיקיות, תזמון משימות
src/lib/docgen/                מחולל מסמכים (docxtemplater) + מיפוי שדות
src/lib/documents/            אחסון/הורדת קבצים (מנסה SharePoint, נופל ל-Drive)
src/lib/msgraph/              לקוח Microsoft Graph (SharePoint)
src/lib/googledrive/          לקוח Google Drive (כולל impersonation לקרדיט)
src/lib/sync/                 מנוע הסנכרון: engine, migration, identity, conflicts
src/app/(app)/                UI: לוח בקרה, תיקים, משימות, מחולל מסמכים, אדמין
src/app/api/webhooks/         נקודות קצה ל-Graph / Drive push notifications
src/app/api/cron/tick         תחזוקה שעתית (חידוש מנויים + poll fallback)
src/app/api/sync/migrate      טריגר להגירה החד-פעמית
src/app/api/files/[id]/       צפייה/הורדה בתוך האפליקציה
cron-worker/                  Worker זעיר נפרד עם Cron Trigger
```

## הרצת בדיקות טיפוסים/לינט

```bash
npx tsc --noEmit
npx eslint .
```
