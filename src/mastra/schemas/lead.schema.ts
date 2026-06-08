import { z } from "zod";

/**
 * Datos que esperamos recibir desde el chat.
 *
 * Este schema sirve como contrato.
 * Si el usuario manda datos incompletos o inválidos,
 * Zod nos ayuda a detectarlo antes de guardar basura en DB.
 */
export const LeadInputSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    role: z.string().optional(),

    need: z.string(),
    budget: z.string().optional(),
    timeline: z.string().optional(),

    rawConversation: z.string(),
    pdfText: z.string().optional(),
});

/**
 * Resultado esperado después de calificar el lead.
 *
 * Este schema nos obliga a que el score siempre tenga
 * una estructura consistente.
 */
export const LeadScoreSchema = z.object({
    score: z.number().min(0).max(100),
    status: z.enum(["qualified", "nurture", "disqualified"]),
    leadType: z.enum(["hr", "dev", "business", "unknown"]),

    reason: z.string(),

    breakdown: z.object({
        budget: z.number(),
        urgency: z.number(),
        fit: z.number(),
        authority: z.number(),
        clarity: z.number(),
    }),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;
export type LeadScore = z.infer<typeof LeadScoreSchema>;