export const config = {
    openai: {
        extractionModel: "gpt-4o-mini",
        followUpModel: "gpt-4o-mini",
        extractionTemperature: 0.2,
        followUpTemperature: 0.5,
        extractionMaxOutputTokens: 1000,
        followUpMaxOutputTokens: 600,
        requestTimeoutMs: 30_000,
    },
    jobs: {
        maxAttempts: 2,
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
