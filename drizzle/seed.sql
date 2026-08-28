-- Initial data: one admin employee + standard case-type templates
-- (folder tree + scheduled task list auto-provisioned on case creation).
--
-- IMPORTANT: the admin password below is "ChangeMe123!" — log in once and
-- change it (Admin > Employees) or replace the hash before seeding prod.

INSERT INTO employees (id, full_name, email, password_hash, role, active)
VALUES (
  '355e546e-7413-481d-8d23-ca1529a97bd0',
  'מנהל מערכת',
  'admin@example.com',
  '$2b$10$cz7TOcqZq056fQQLhfu8LOi3SjuLKuMXsu02wb1GQ9TOw/CaH.9tK',
  'admin',
  1
);

INSERT INTO case_types (id, name, description, folder_template, task_template)
VALUES (
  '03839934-7a2c-481b-a5df-04886f1ce1af',
  'תביעה אזרחית',
  'תיק תביעה אזרחית בבית משפט',
  '["כתבי טענות","התכתבויות","מסמכים מהלקוח","פרוטוקולים","חוות דעת","תיק עבודה פנימי"]',
  '[
    {"title":"פתיחת תיק ובדיקת ניגוד עניינים","dueOffsetDays":1,"assigneeRole":"secretary"},
    {"title":"עריכת ייפוי כוח וחתימת הלקוח","dueOffsetDays":3,"assigneeRole":"associate"},
    {"title":"איסוף מסמכים ותצהירים מהלקוח","dueOffsetDays":7,"assigneeRole":"associate"},
    {"title":"הכנת כתב תביעה","dueOffsetDays":21,"assigneeRole":"associate"},
    {"title":"הגשת כתב תביעה לבית המשפט","dueOffsetDays":30,"assigneeRole":"partner"}
  ]'
);

INSERT INTO case_types (id, name, description, folder_template, task_template)
VALUES (
  'a711e388-bf4e-421f-97b4-92a470078dc8',
  'הוצאה לפועל',
  'תיק הוצאה לפועל',
  '["בקשות ופתיחת תיק","אזהרות והליכים","עיקולים","התכתבויות","תיק עבודה פנימי"]',
  '[
    {"title":"פתיחת תיק הוצל״פ","dueOffsetDays":1,"assigneeRole":"secretary"},
    {"title":"שליחת אזהרה לחייב","dueOffsetDays":5,"assigneeRole":"associate"},
    {"title":"בדיקת סטטוס לאחר 30 יום","dueOffsetDays":30,"assigneeRole":"associate"}
  ]'
);

INSERT INTO case_types (id, name, description, folder_template, task_template)
VALUES (
  'a823033d-da81-4294-a5fc-03b8b1321bcc',
  'תיק כללי',
  'תבנית כללית לכל סוג תיק אחר',
  '["מסמכים מהלקוח","התכתבויות","תיק עבודה פנימי"]',
  '[
    {"title":"פתיחת תיק ובדיקת ניגוד עניינים","dueOffsetDays":1,"assigneeRole":"secretary"},
    {"title":"פגישת פתיחה עם הלקוח","dueOffsetDays":5,"assigneeRole":"associate"}
  ]'
);
