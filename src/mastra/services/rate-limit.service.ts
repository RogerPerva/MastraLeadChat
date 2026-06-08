type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const requestsByClient = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
    allowed: boolean;
    retryAfterSeconds: number;
};

/**
 * Rate limiter en memoria para despliegues de prueba con una sola instancia.
 * En producción con varias instancias debe reemplazarse por Redis o equivalente.
 */
export function checkRateLimit(
    clientId: string,
    limit = 10,
    windowMs = 10 * 60 * 1_000
): RateLimitResult {
    const now = Date.now();
    const current = requestsByClient.get(clientId);

    if (!current || current.resetAt <= now) {
        requestsByClient.set(clientId, {
            count: 1,
            resetAt: now + windowMs,
        });

        return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= limit) {
        return {
            allowed: false,
            retryAfterSeconds: Math.ceil((current.resetAt - now) / 1_000),
        };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
}
