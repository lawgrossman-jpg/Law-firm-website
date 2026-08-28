// One-off generator for the seed document templates (ייפוי כוח / כתב
// תביעה). Produces real .docx files with docxtemplater-style {tag}
// placeholders under drizzle/templates/, which scripts/seed-templates.mjs
// then base64-encodes into a D1 seed SQL file. Not used at runtime.
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "drizzle", "templates");
await mkdir(outDir, { recursive: true });

function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 200 },
    children: [new TextRun({ text, rightToLeft: true, ...opts })],
  });
}

const poaDoc = new Document({
  sections: [
    {
      children: [
        p("ייפוי כוח", { bold: true, size: 32 }),
        p(""),
        p(
          "אני החתום מטה, {client_full_name}, נושא ת.ז. מספר {client_id_number}, מרחוב {client_address}, מייפה בזאת את כוחו של עורך הדין {responsible_lawyer_name} ו/או מי מטעם משרדו, לייצג אותי בכל הקשור לתיק {case_title} (מספר תיק {case_number}, מספר הליך {court_case_number}), לרבות בפני כל ערכאה שיפוטית, רשות מנהלית, לשכת הוצאה לפועל, ביטוח לאומי וכל גורם רלוונטי אחר.",
        ),
        p(""),
        p("ולראיה באתי על החתום:"),
        p(""),
        p("תאריך: {today_date}"),
        p(""),
        p("חתימת הלקוח: _______________________"),
      ],
    },
  ],
});

const claimDoc = new Document({
  sections: [
    {
      children: [
        p("כתב תביעה", { bold: true, size: 32 }),
        p(""),
        p("בעניין: {case_title}   (מספר תיק פנימי: {case_number})", { bold: true }),
        p(""),
        p("התובע: {plaintiff_full_name}, ת.ז. {client_id_number}, {client_address}"),
        p("- נגד -"),
        p("הנתבע: {defendant_full_name}"),
        p(""),
        p("מספר הליך בבית המשפט: {court_case_number}"),
        p(""),
        p("כתב טענות זה מוגש מטעם התובע באמצעות ב״כ עו״ד {responsible_lawyer_name}."),
        p(""),
        p("תאריך: {today_date}"),
        p(""),
        p("_______________________"),
        p("{responsible_lawyer_name}, עו״ד — ב״כ התובע"),
      ],
    },
  ],
});

const poaBuf = await Packer.toBuffer(poaDoc);
await writeFile(path.join(outDir, "power_of_attorney.docx"), poaBuf);

const claimBuf = await Packer.toBuffer(claimDoc);
await writeFile(path.join(outDir, "statement_of_claim.docx"), claimBuf);

console.log("Generated templates in", outDir);
