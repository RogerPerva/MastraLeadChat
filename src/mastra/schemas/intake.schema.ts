import { z } from "zod";
import { MAX_PDF_BASE64_LENGTH } from "../services/pdf.service";

const EMAIL_IN_MESSAGE_PATTERN =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Contrato de la única entrada pública del sistema.
 * Limita el payload antes de ejecutar IA o acceder a servicios externos.
 */
export const intakeInputSchema = z.object({
    message: z
        .string()
        .trim()
        .min(10)
        .max(5_000)
        .refine(
            (message) => EMAIL_IN_MESSAGE_PATTERN.test(message),
            "El mensaje debe incluir un correo electrónico válido."
        ),
    pdfBase64: z.string().max(MAX_PDF_BASE64_LENGTH).optional(),
    pdfName: z.string().trim().min(1).max(255).optional(),
});

export const intakeOutputSchema = z.object({
    leadId: z.string(),
    score: z.number().min(0).max(100),
    status: z.enum(["qualified", "nurture", "disqualified"]),

    // Datos enriquecidos para el panel de resultados del demo
    leadType: z.string(),
    reason: z.string(),
    breakdown: z.object({
        budget: z.number(),
        urgency: z.number(),
        authority: z.number(),
        clarity: z.number(),
        fit: z.number(),
    }),
    toolsUsed: z.array(z.string()),
    supabaseStatus: z.enum(["saved"]),
    hubspotStatus: z.enum(["contact_created", "contact_updated", "skipped"]),
});
