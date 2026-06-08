import { z } from "zod";

function optionalText<T extends z.ZodType>(schema: T) {
    return z.preprocess(
        (value) =>
            typeof value === "string" && value.trim() === ""
                ? undefined
                : value,
        schema.optional()
    );
}

/**
 * Contrato único de los datos que la IA extrae del mensaje y del PDF.
 * Lo comparten el structured output del agente y los pasos del workflow.
 */
export const leadAnalysisSchema = z.object({
    name: optionalText(z.string()),
    email: optionalText(z.string().email()),
    phone: optionalText(z.string()),
    company: optionalText(z.string()),
    role: optionalText(z.string()),

    leadType: z.enum(["hr", "dev", "business", "unknown"]),
    need: z.string(),
    budget: optionalText(z.string()),
    timeline: optionalText(z.string()),

    hasBudget: z.boolean(),
    hasUrgency: z.boolean(),
    hasDecisionAuthority: z.boolean(),
    hasClearNeed: z.boolean(),
    fitLevel: z.enum(["low", "medium", "high"]),

    reason: z.string(),
});

export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;
