// Base64-encodes drizzle/templates/*.docx into a D1 seed SQL file
// (drizzle/seed_templates.sql). Run after scripts/generate-templates.mjs.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const templatesDir = path.join(process.cwd(), "drizzle", "templates");

const entries = [
  {
    file: "power_of_attorney.docx",
    name: "ייפוי כוח",
    description: "ייפוי כוח כללי ללקוח בתיק",
    category: "כללי",
    placeholders: [
      "client_full_name",
      "client_id_number",
      "client_address",
      "responsible_lawyer_name",
      "case_title",
      "case_number",
      "court_case_number",
      "today_date",
    ],
  },
  {
    file: "statement_of_claim.docx",
    name: "כתב תביעה",
    description: "כתב תביעה בסיסי לתיק אזרחי",
    category: "כתבי טענות",
    placeholders: [
      "case_title",
      "case_number",
      "plaintiff_full_name",
      "defendant_full_name",
      "client_id_number",
      "client_address",
      "court_case_number",
      "responsible_lawyer_name",
      "today_date",
    ],
  },
];

function sqlEscape(str) {
  return str.replace(/'/g, "''");
}

let sql =
  "-- Seed document_templates with generated .docx templates.\n-- Regenerate via: node scripts/generate-templates.mjs && node scripts/seed-templates.mjs\n\n";

for (const entry of entries) {
  const buf = await readFile(path.join(templatesDir, entry.file));
  const base64 = buf.toString("base64");
  const id = crypto.randomUUID();
  sql += `INSERT INTO document_templates (id, name, description, category, docx_base64, placeholders)\nVALUES ('${id}', '${sqlEscape(entry.name)}', '${sqlEscape(entry.description)}', '${sqlEscape(entry.category)}', '${base64}', '${JSON.stringify(entry.placeholders)}');\n\n`;
}

await writeFile(path.join(process.cwd(), "drizzle", "seed_templates.sql"), sql);
console.log("Wrote drizzle/seed_templates.sql");
