import { getDocumentProxy, extractText } from "unpdf";

export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_SIZE_BYTES * 4) / 3) + 4;

/**
 * Servicio para extraer texto de un PDF.
 *
 * Este servicio NO decide si un lead califica.
 * Solo convierte PDF → texto plano.
 */
export async function extractTextFromPdf(fileBuffer: Buffer): Promise<string> {
    if (fileBuffer.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error("El PDF excede el tamaño máximo permitido de 5 MB.");
    }

    const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
    const { text } = await extractText(pdf, { mergePages: true });

    if (!text.trim()) {
        throw new Error("No se pudo extraer texto del PDF.");
    }

    return text.slice(0, 20_000);
}
