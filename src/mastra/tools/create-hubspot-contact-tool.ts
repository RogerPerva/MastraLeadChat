import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const hubSpotContactInputSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    role: z.string().optional(),
});

export type HubSpotContactInput = z.infer<typeof hubSpotContactInputSchema>;

type HubSpotUpsertResponse = {
    results?: Array<{ id?: string }>;
};

/**
 * Crea o actualiza un contacto usando el email como identificador único.
 */
export async function upsertHubSpotContact(
    input: HubSpotContactInput
): Promise<{ hubspotContactId: string }> {
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

    if (!accessToken) {
        throw new Error("HUBSPOT_ACCESS_TOKEN no está configurado.");
    }

    const properties = Object.fromEntries(
        Object.entries({
            firstname: input.name,
            phone: input.phone,
            company: input.company,
            jobtitle: input.role,
        }).filter((entry): entry is [string, string] => Boolean(entry[1]))
    );

    const response = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: [
                    {
                        id: input.email,
                        idProperty: "email",
                        properties,
                    },
                ],
            }),
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `Error sincronizando contacto en HubSpot (${response.status}): ${errorBody}`
        );
    }

    const data = (await response.json()) as HubSpotUpsertResponse;
    const hubspotContactId = data.results?.[0]?.id;

    if (!hubspotContactId) {
        throw new Error("HubSpot no devolvió el id del contacto.");
    }

    return { hubspotContactId };
}

/**
 * Crea o actualiza un contacto en HubSpot.
 *
 * Esta tool solo debe usarse cuando el lead ya calificó.
 */
export const createHubSpotContactTool = createTool({
    id: "create-hubspot-contact",

    description: "Crea o actualiza un contacto en HubSpot para leads calificados.",

    inputSchema: hubSpotContactInputSchema,
    outputSchema: z.object({
        hubspotContactId: z.string(),
    }),

    // TOOL: el input llega como primer argumento directo (ver save-lead-tool).
    execute: async (inputData) => upsertHubSpotContact(inputData),
});
