import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Crea un contacto en HubSpot.
 *
 * Esta tool solo debe usarse cuando el lead ya calificó.
 */
export const createHubSpotContactTool = createTool({
    id: "create-hubspot-contact",

    description: "Crea un contacto en HubSpot para leads calificados.",

    inputSchema: z.object({
        email: z.string().email(),
        name: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        role: z.string().optional(),

        score: z.number(),
        leadType: z.string(),
        qualificationReason: z.string(),
    }),

    outputSchema: z.object({
        hubspotContactId: z.string(),
    }),

    // TOOL: el input llega como primer argumento directo (ver save-lead-tool).
    execute: async (inputData) => {
        const response = await fetch(
            "https://api.hubapi.com/crm/v3/objects/contacts",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    properties: {
                        email: inputData.email,
                        firstname: inputData.name,
                        phone: inputData.phone,
                        company: inputData.company,
                        jobtitle: inputData.role,

                        /**
                         * Para guardar estas propiedades personalizadas,
                         * primero deberías crearlas en HubSpot:
                         * - lead_score
                         * - lead_type
                         * - qualification_reason
                         */
                        lead_score: String(inputData.score),
                        lead_type: inputData.leadType,
                        qualification_reason: inputData.qualificationReason,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Error creando contacto en HubSpot: ${errorBody}`);
        }

        const data = await response.json();

        return {
            hubspotContactId: data.id,
        };
    },
});