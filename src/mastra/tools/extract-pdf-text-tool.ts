import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    extractTextFromPdf,
    MAX_PDF_BASE64_LENGTH,
    MAX_PDF_SIZE_BYTES,
} from "../services/pdf.service";

/**
 * Tool que convierte un PDF en texto.
 *
 * Esta tool puede usarse antes de mandar el contexto al agente.
 */
export const extractPdfTextTool = createTool({
    id: "extract-pdf-text",

    description: "Extrae texto desde un archivo PDF de requerimientos.",

    inputSchema: z.object({
        fileBufferBase64: z.string().max(MAX_PDF_BASE64_LENGTH),
        fileName: z.string(),
        mimeType: z.string(),
        fileSizeBytes: z.number(),
    }),

    outputSchema: z.object({
        extractedText: z.string(),
    }),

    // TOOL: el input llega como primer argumento directo (ver save-lead-tool).
    execute: async (inputData) => {
        if (inputData.mimeType !== "application/pdf") {
            throw new Error("Solo se permiten archivos PDF.");
        }

        if (inputData.fileSizeBytes > MAX_PDF_SIZE_BYTES) {
            throw new Error("El PDF excede el tamaño máximo permitido de 5 MB.");
        }

        const buffer = Buffer.from(inputData.fileBufferBase64, "base64");

        const extractedText = await extractTextFromPdf(buffer);

        return { extractedText };
    },
});
