import { getDocumentProxy, extractText } from "unpdf";

/**
 * Servicio para extraer texto de un PDF.
 *
 * Este servicio NO decide si un lead califica.
 * Solo convierte PDF → texto plano.
 */
export async function extractTextFromPdf(fileBuffer: Buffer): Promise<string> {
    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
}