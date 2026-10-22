/**
 * Reads the text of a PDF IN THE BROWSER. The file never leaves the user's device: it is read into
 * memory, its text is extracted, and the bytes are dropped. Only text the user chooses to import
 * is ever sent to the server, and only after review.
 */

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;

export function looksLikePdf(bytes: Uint8Array): boolean {
  // Files normally start with "%PDF-"; a few have a short preamble, so look in the first 1 KB.
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  return head.includes("%PDF-");
}

export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number; truncated: boolean }> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("That PDF is larger than 8 MB.");
  if (!looksLikePdf(bytes)) throw new Error("That file does not look like a PDF.");
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const pages = pdf.numPages;
  const { text } = await extractText(pdf, { mergePages: false });
  const list = Array.isArray(text) ? text : [text];
  return { text: list.slice(0, MAX_PDF_PAGES).join("\n\n"), pages, truncated: pages > MAX_PDF_PAGES };
}
