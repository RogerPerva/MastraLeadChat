import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { leadAgent } from './agents/lead-agent';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { leadQualificationWorkflow } from './workflows/lead-qualification-workflow';
import { createHubSpotContactTool } from './tools/create-hubspot-contact-tool';
import { extractPdfTextTool } from './tools/extract-pdf-text-tool';
import { saveLeadTool } from './tools/save-lead-tool';
import { scoreLeadTool } from './tools/score-lead-tool';

export const mastra = new Mastra({
    workflows: { leadQualificationWorkflow },
    agents: { leadAgent },
    tools: {
        createHubSpotContactTool,
        extractPdfTextTool,
        saveLeadTool,
        scoreLeadTool,
    },
    storage: new MastraCompositeStore({
        id: 'composite-storage',
        default: new LibSQLStore({
            id: "mastra-storage",
            url: "file:./mastra.db",
        }),
        domains: {
            observability: await new DuckDBStore().getStore('observability'),
        }
    }),
    logger: new PinoLogger({
        name: 'Mastra',
        level: 'info',
    }),
    observability: new Observability({
        configs: {
            default: {
                serviceName: 'mastra',
                exporters: [
                    new MastraStorageExporter(), // Persists observability events to Mastra Storage
                    new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
                ],
                spanOutputProcessors: [
                    new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
                ],
            },
        },
    }),
});
