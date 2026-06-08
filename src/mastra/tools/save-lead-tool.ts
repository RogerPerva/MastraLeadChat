import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { supabaseAdmin } from "../services/supabase.service";

/**
 * Guarda el lead en Supabase.
 *
 * Todos los leads se guardan, califiquen o no, para poder
 * medir conversión después.
 *
 * Igual que score-lead: la lógica vive en una función pura (`insertLead`)
 * y la tool solo la envuelve.
 */

export const saveLeadInputSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    role: z.string().optional(),

    leadType: z.string(),
    need: z.string(),
    budget: z.string().optional(),
    timeline: z.string().optional(),

    score: z.number(),
    status: z.string(),
    qualificationReason: z.string(),
});

export type SaveLeadInput = z.infer<typeof saveLeadInputSchema>;

/**
 * Inserta un lead en la tabla `leads` y devuelve su id.
 */
export async function insertLead(input: SaveLeadInput): Promise<{ leadId: string }> {
    const { data, error } = await supabaseAdmin
        .from("leads")
        .insert({
            name: input.name,
            email: input.email,
            phone: input.phone,
            company: input.company,
            role: input.role,

            lead_type: input.leadType,
            need: input.need,
            budget: input.budget,
            timeline: input.timeline,

            score: input.score,
            status: input.status,
            qualification_reason: input.qualificationReason,
        })
        .select("id")
        .single();

    if (error) {
        throw new Error(`Error guardando lead: ${error.message}`);
    }

    return { leadId: String(data.id) };
}

/**
 * Relaciona el lead guardado con el contacto sincronizado en HubSpot.
 */
export async function updateLeadHubSpotContactId(
    leadId: string,
    hubspotContactId: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("leads")
        .update({ hubspot_contact_id: hubspotContactId })
        .eq("id", leadId);

    if (error) {
        throw new Error(
            `Error actualizando el contacto de HubSpot en el lead: ${error.message}`
        );
    }
}

export const saveLeadTool = createTool({
    id: "save-lead",
    description: "Guarda un lead en Supabase.",
    inputSchema: saveLeadInputSchema,
    outputSchema: z.object({ leadId: z.string() }),
    execute: async (inputData) => insertLead(inputData),
});
