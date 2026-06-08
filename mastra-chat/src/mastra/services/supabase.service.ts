import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo de Supabase.
 *
 * Se usa desde backend/Mastra para insertar leads,
 * guardar auditoría y consultar lineamientos.
 *
 * IMPORTANTE:
 * No usar este cliente en frontend porque usa SERVICE_ROLE_KEY.
 */
export const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);