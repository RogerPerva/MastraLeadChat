import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { extractTextFromPdf } from "../services/pdf.service";

/**
 * Tool que convierte un PDF en texto.
 *
 * Esta tool puede usarse antes de mandar el contexto al agente.
 */
export const extractPdfTextTool = createTool({
    id: "extract-pdf-text",

    description: "Extrae texto desde un archivo PDF de requerimientos.",

    inputSchema: z.object({
        fileBufferBase64: z.string(),
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

        const maxSizeBytes = 5 * 1024 * 1024;

        if (inputData.fileSizeBytes > maxSizeBytes) {
            throw new Error("El PDF excede el tamaño máximo permitido de 5 MB.");
        }

        const buffer = Buffer.from(inputData.fileBufferBase64, "base64");

        const extractedText = await extractTextFromPdf(buffer);

        if (!extractedText.trim()) {
            throw new Error("No se pudo extraer texto del PDF.");
        }

        return {
            extractedText: extractedText.slice(0, 20_000),
        };
    },
});