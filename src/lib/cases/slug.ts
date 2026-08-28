/** Builds a filesystem-safe folder name from a case number + title,
 * keeping Hebrew characters (valid in SharePoint/Drive paths) and
 * stripping characters that are illegal in either provider. */
export function caseFolderName(caseNumber: string, title: string): string {
  const cleanTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return `${caseNumber}-${cleanTitle}`;
}
