import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { leadAgent } from './agents/lead-agent';
import { leadQualificationWorkflow } from './workflows/lead-qualification-workflow';
import { createHubSpotContactTool } from './tools/create-hubspot-contact-tool';
import { extractPdfTextTool } from './tools/extract-pdf-text-tool';
import { saveLeadTool } from './tools/save-lead-tool';
import { scoreLeadTool } from './tools/score-lead-tool';
import { SimpleAuth } from '@mastra/core/server';
import { intakeHomeRoute, intakePageRoute, intakeRoute } from './routes/intake.route';
import { resolve } from 'node:path';

type AdminUser = {
    id: string;
    role: "admin";
};

function createAdminAuth() {
    const adminApiKey = process.env.ADMIN_API_KEY;

    if (!adminApiKey) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("ADMIN_API_KEY es obligatoria en producción.");
        }

        return undefined;
    }

    return new SimpleAuth<AdminUser>({
        tokens: {
            [adminApiKey]: {
                id: "admin",
                role: "admin",
            },
        },
    });
}

const projectRoot = process.env.INIT_CWD ?? process.cwd();
const libsqlPath = resolve(projectRoot, "mastra.db");

export const mastra = new Mastra({
    workflows: { leadQualificationWorkflow },
    agents: { leadAgent },
    tools: {
        createHubSpotContactTool,
        extractPdfTextTool,
        saveLeadTool,
        scoreLeadTool,
    },
    server: {
        host: "0.0.0.0",
        auth: createAdminAuth(),
        apiRoutes: [intakeHomeRoute, intakePageRoute, intakeRoute],
        build: {
            apiReqLogs: true,
        },
    },
    storage: new LibSQLStore({
        id: "mastra-storage",
        url: `file:${libsqlPath}`,
    }),
    logger: new PinoLogger({
        name: 'Mastra',
        level: 'info',
    }),
});
