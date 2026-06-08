import { z } from "zod";

/**
 * Contrato único de los datos que la IA extrae del mensaje y del PDF.
 * Lo comparten el structured output del agente y los pasos del workflow.
 */
export const leadAnalysisSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    role: z.string().optional(),

    leadType: z.enum(["hr", "dev", "business", "unknown"]),
    need: z.string(),
    budget: z.string().optional(),
    timeline: z.string().optional(),

    hasBudget: z.boolean(),
    hasUrgency: z.boolean(),
    hasDecisionAuthority: z.boolean(),
    hasClearNeed: z.boolean(),
    fitLevel: z.enum(["low", "medium", "high"]),

    reason: z.string(),
});

export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;
