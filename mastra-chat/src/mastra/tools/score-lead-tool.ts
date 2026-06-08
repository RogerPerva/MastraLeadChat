import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Reglas de scoring del lead.
 *
 * Patrón importante: la LÓGICA vive en una función pura normal
 * (`calculateLeadScore`), y la TOOL solo la envuelve para Mastra.
 *
 * Ventaja: el workflow puede llamar `calculateLeadScore(...)` directo
 * (es solo TypeScript), y la función se puede probar sin Mastra.
 */

export const scoreInputSchema = z.object({
    hasBudget: z.boolean(),
    hasUrgency: z.boolean(),
    hasDecisionAuthority: z.boolean(),
    hasClearNeed: z.boolean(),
    fitLevel: z.enum(["low", "medium", "high"]),
});

export const scoreOutputSchema = z.object({
    score: z.number(),
    status: z.enum(["qualified", "nurture", "disqualified"]),
    breakdown: z.object({
        budget: z.number(),
        urgency: z.number(),
        fit: z.number(),
        authority: z.number(),
        clarity: z.number(),
    }),
});

export type ScoreInput = z.infer<typeof scoreInputSchema>;
export type ScoreResult = z.infer<typeof scoreOutputSchema>;

/**
 * Función pura: mismas entradas -> mismas salidas. Sin IA, sin red.
 * Aquí es donde controlas la decisión comercial.
 */
export function calculateLeadScore(input: ScoreInput): ScoreResult {
    const budget = input.hasBudget ? 20 : 5;
    const urgency = input.hasUrgency ? 20 : 5;
    const authority = input.hasDecisionAuthority ? 20 : 5;
    const clarity = input.hasClearNeed ? 15 : 5;

    const fit =
        input.fitLevel === "high" ? 25 : input.fitLevel === "medium" ? 15 : 5;

    const score = budget + urgency + authority + clarity + fit;

    const status =
        score >= 75 ? "qualified" : score >= 50 ? "nurture" : "disqualified";

    return {
        score,
        status,
        breakdown: { budget, urgency, fit, authority, clarity },
    };
}

/**
 * La tool solo expone la función a Mastra (para el agente / MCP).
 * El workflow usa `calculateLeadScore` directamente.
 */
export const scoreLeadTool = createTool({
    id: "score-lead",
    description: "Calcula el score comercial de un lead con reglas deterministas.",
    inputSchema: scoreInputSchema,
    outputSchema: scoreOutputSchema,
    execute: async (inputData) => calculateLeadScore(inputData),
});
