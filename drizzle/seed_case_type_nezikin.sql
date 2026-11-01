-- Seed the "נזיקין" (tort) case type: folder template + opening task list.
-- Standalone seed file (like seed_sharepoint_libraries.sql) picked up by
-- `wrangler d1 migrations apply` without touching the numbered migrations.

INSERT INTO case_types (id, name, description, folder_template, task_template)
VALUES (
  'e3a2a6c1-6c0a-4f0b-8f1a-1a8b6e7a1a4b',
  'נזיקין',
  'תיק נזיקין (תאונות דרכים, תאונות עבודה, רשלנות)',
  '["חומר רפואי","חוות דעת","כתבי טענות","התכתבויות","תיק עבודה פנימי"]',
  '[
    {"title":"פתיחת תיק ובדיקת ניגוד עניינים","dueOffsetDays":1,"assigneeRole":"secretary"},
    {"title":"עריכת ייפוי כוח וחתימת הלקוח","dueOffsetDays":3,"assigneeRole":"associate"},
    {"title":"איתור מקורות חומר רפואי ופתיחת בקשות","dueOffsetDays":5,"assigneeRole":"secretary"},
    {"title":"קביעת ראשי נזק ראשוניים","dueOffsetDays":14,"assigneeRole":"associate"},
    {"title":"פנייה למומחה רפואי לחוות דעת","dueOffsetDays":30,"assigneeRole":"associate"}
  ]'
);
