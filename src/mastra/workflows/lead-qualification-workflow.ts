import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { calculateLeadScore } from "../tools/score-lead-tool";
import { insertLead } from "../tools/save-lead-tool";
import { extractTextFromPdf, MAX_PDF_BASE64_LENGTH } from "../services/pdf.service";
import { leadAnalysisSchema } from "../schemas/lead.schema";

/**
 * WORKFLOW DE CALIFICACIÓN DE LEADS — Fase 2
 *
 * Flujo: mensaje/PDF --> (0) extraer PDF --> (1) analizar con IA
 *        --> (2) score con reglas --> (3) guardar en Supabase
 *
 * Idea clave: la IA SOLO interpreta y extrae datos (paso 1).
 * Las decisiones comerciales (score) y la persistencia (Supabase)
 * son deterministas y viven en tools, no en el prompt.
 */

/**
 * Paso 0 (opcional): Si viene un PDF en base64, extrae su texto.
 * Si no hay PDF, pasa el mensaje tal cual al siguiente paso.
 */
const extractPdfStep = createStep({
    id: "extract-pdf-step",

    inputSchema: z.object({
        message: z.string(),
        pdfBase64: z.string().max(MAX_PDF_BASE64_LENGTH).optional(),
        pdfName: z.string().optional(),
    }),

    outputSchema: z.object({
        message: z.string(),
        pdfText: z.string().optional(),
    }),

    execute: async ({ inputData }) => {
        if (!inputData.pdfBase64) {
            return { message: inputData.message };
        }

        const buffer = Buffer.from(inputData.pdfBase64, "base64");
        const pdfText = await extractTextFromPdf(buffer);

        return {
            message: inputData.message,
            pdfText,
        };
    },
});

/**
 * Paso 1: Analiza el mensaje del usuario y extrae datos estructurados.
 *
 * Usamos `structuredOutput`: en lugar de pedir "responde JSON" y luego
 * hacer JSON.parse (frágil), Mastra obliga al modelo a devolver un objeto
 * que cumple el schema y lo deja en `response.object`.
 */
const analyzeLeadStep = createStep({
    id: "analyze-lead",

    inputSchema: z.object({
        message: z.string(),
        pdfText: z.string().optional(),
    }),

    outputSchema: leadAnalysisSchema,

    // STEP: el input llega dentro de un objeto -> { inputData, mastra }
    execute: async ({ inputData, mastra }) => {
        // OJO: getAgent usa la LLAVE con la que se registró en index.ts
        // (agents: { leadAgent }), no el `id` del agente.
        const agent = mastra.getAgent("leadAgent");

        const response = await agent.generate(
            `Analiza este lead y extrae los datos solicitados.

Mensaje del usuario:
${inputData.message}

Texto extraído del PDF:
${inputData.pdfText ?? "No se proporcionó PDF."}`,
            {
                structuredOutput: { schema: leadAnalysisSchema },
            }
        );

        return response.object;
    },
});

/**
 * Paso 2: Calcula el score con reglas controladas (tool determinista).
 */
const scoreStep = createStep({
    id: "score-lead-step",

    inputSchema: leadAnalysisSchema,

    outputSchema: z.object({
        lead: leadAnalysisSchema,
        score: z.number(),
        status: z.enum(["qualified", "nurture", "disqualified"]),
        breakdown: z.object({
            budget: z.number(),
            urgency: z.number(),
            fit: z.number(),
            authority: z.number(),
            clarity: z.number(),
        }),
    }),

    execute: async ({ inputData }) => {
        // Llamamos la función pura de scoring (solo TypeScript, determinista).
        const scoreResult = calculateLeadScore({
            hasBudget: inputData.hasBudget,
            hasUrgency: inputData.hasUrgency,
            hasDecisionAuthority: inputData.hasDecisionAuthority,
            hasClearNeed: inputData.hasClearNeed,
            fitLevel: inputData.fitLevel,
        });

        return {
            lead: inputData,
            score: scoreResult.score,
            status: scoreResult.status,
            breakdown: scoreResult.breakdown,
        };
    },
});

/**
 * Paso 3: Guarda SIEMPRE el lead en Supabase (califique o no).
 * Así puedes medir conversión después.
 */
const saveStep = createStep({
    id: "save-lead-step",

    inputSchema: scoreStep.outputSchema,

    outputSchema: z.object({
        leadId: z.string(),
        score: z.number(),
        status: z.string(),
    }),

    execute: async ({ inputData }) => {
        const result = await insertLead({
            name: inputData.lead.name,
            email: inputData.lead.email,
            phone: inputData.lead.phone,
            company: inputData.lead.company,
            role: inputData.lead.role,

            leadType: inputData.lead.leadType,
            need: inputData.lead.need,
            budget: inputData.lead.budget,
            timeline: inputData.lead.timeline,

            score: inputData.score,
            status: inputData.status,
            qualificationReason: inputData.lead.reason,
        });

        return {
            leadId: result.leadId,
            score: inputData.score,
            status: inputData.status,
        };
    },
});

export const leadQualificationWorkflow = createWorkflow({
    id: "lead-qualification-workflow",

    inputSchema: z.object({
        message: z.string(),
        pdfBase64: z.string().max(MAX_PDF_BASE64_LENGTH).optional(),
        pdfName: z.string().optional(),
    }),

    outputSchema: z.object({
        leadId: z.string(),
        score: z.number(),
        status: z.string(),
    }),
})
    .then(extractPdfStep)
    .then(analyzeLeadStep)
    .then(scoreStep)
    .then(saveStep)
    .commit();
