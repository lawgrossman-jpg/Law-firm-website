import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/** Fills a .docx template's {tag} placeholders with flat string values and
 * returns the rendered document bytes. */
export function renderDocxTemplate(
  templateBase64: string,
  data: Record<string, string>,
): Uint8Array {
  const zip = new PizZip(templateBase64, { base64: true });
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(data);
  return doc.getZip().generate({ type: "uint8array" });
}
