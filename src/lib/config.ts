export const config = {
    gemini: {
        extractionModel: "gemini-3.6-flash",
        followUpModel: "gemini-3.6-flash",
        extractionTemperature: 0.2,
        followUpTemperature: 0.5,
        extractionMaxOutputTokens: 8192,
        followUpMaxOutputTokens: 2048,
        requestTimeoutMs: 30_000,
        maxRetries: 3,
        retryDelayMs: 2_000,
    },
    jobs: {
        maxAttempts: 4,
        maxConcurrency: 3,
        pollIntervalMs: 1500,
    },
    uploads: {
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        storageDir: "public/uploads",
    },
    rateLimit: {
        upload: { windowMs: 60_000, max: 5 },
        followUp: { windowMs: 60_000, max: 10 },
    },
};
