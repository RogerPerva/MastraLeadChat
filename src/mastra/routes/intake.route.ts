import { registerApiRoute } from "@mastra/core/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { intakeInputSchema } from "../schemas/intake.schema";
import { checkRateLimit } from "../services/rate-limit.service";

function getClientId(headers: Headers): string {
    return (
        headers.get("cf-connecting-ip") ??
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

async function serveIntakePage(): Promise<Response> {
    const productionPath = new URL("./intake.html", import.meta.url);
    const projectRoot = process.env.INIT_CWD ?? process.cwd();
    const developmentPath = resolve(
        projectRoot,
        "src/mastra/public/intake.html"
    );

    let html: string;

    try {
        html = await readFile(productionPath, "utf8");
    } catch {
        html = await readFile(developmentPath, "utf8");
    }

    return new Response(html, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
    });
}

export const intakeRoute = registerApiRoute("/intake", {
    method: "POST",
    requiresAuth: false,

    handler: async (context) => {
        const rateLimit = checkRateLimit(getClientId(context.req.raw.headers));

        if (!rateLimit.allowed) {
            context.header("Retry-After", String(rateLimit.retryAfterSeconds));
            return context.json(
                {
                    error: "Demasiadas solicitudes. Intenta nuevamente más tarde.",
                },
                429
            );
        }

        let body: unknown;

        try {
            body = await context.req.json();
        } catch {
            return context.json({ error: "El cuerpo debe ser JSON válido." }, 400);
        }

        const parsedInput = intakeInputSchema.safeParse(body);

        if (!parsedInput.success) {
            return context.json(
                {
                    error: "Los datos enviados no son válidos.",
                    fields: parsedInput.error.flatten().fieldErrors,
                },
                400
            );
        }

        try {
            const mastra = context.get("mastra");
            const workflow = mastra.getWorkflow("leadQualificationWorkflow");
            const run = await workflow.createRun();
            const result = await run.start({ inputData: parsedInput.data });

            if (result.status !== "success") {
                console.error("El workflow de intake no terminó correctamente.", {
                    runId: run.runId,
                    status: result.status,
                });

                return context.json(
                    { error: "No se pudo procesar la solicitud." },
                    500
                );
            }

            return context.json(result.result, 201);
        } catch (error) {
            console.error("Error inesperado procesando intake.", error);
            return context.json(
                { error: "No se pudo procesar la solicitud." },
                500
            );
        }
    },
});

export const intakePageRoute = registerApiRoute("/intake.html", {
    method: "GET",
    requiresAuth: false,
    handler: serveIntakePage,
});

export const intakeHomeRoute = registerApiRoute("/", {
    method: "GET",
    requiresAuth: false,
    handler: serveIntakePage,
});
