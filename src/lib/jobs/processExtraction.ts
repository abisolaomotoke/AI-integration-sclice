import { db } from "@/lib/db";
import { genAI } from "@/lib/gemini";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { readUpload } from "@/lib/storage";
import { config } from "@/lib/config";
import { extractionJsonSchema, extractionResultSchema } from "@/lib/schemas";

const SYSTEM_PROMPT = `You transcribe and structure handwritten notes from images.
Read the handwriting carefully, including cross-outs and margin notes.
Extract:
- a short title summarizing the page's topic
- the main points as bullet points, in the order they appear
- any action items (tasks, to-dos, "must", "need to") as a separate list
- any dates mentioned, in the format they appear in the note

If the handwriting is illegible in places, note that in the relevant bullet
point rather than guessing at words you cannot make out. Do not invent
content that is not on the page.

Respond with ONLY valid JSON matching this exact shape, no other text:
{ "title": string, "bulletPoints": string[], "actionItems": string[], "datesMentioned": string[] }`;

type GeminiErrorClass = "quota" | "transient" | "fatal";

const QUOTA_ERROR_RE =
  /RATE_LIMIT_EXCEEDED|RESOURCE_EXHAUSTED|quota exceeded|quota|rate limit|rate-limit/i;
const TRANSIENT_ERROR_RE =
  /503|unavailable|overloaded|high demand|no healthy upstream|server error/i;

/**
 * Classifies a Gemini SDK error:
 * - "quota": HTTP 429 — the project's Gemini quota/rate limit is exhausted.
 *   Retrying within the worker's window won't help, so callers must NOT retry.
 * - "transient": HTTP 5xx / temporary service overload which may clear in seconds.
 * - "fatal": anything else (bad input, auth, model deprecation, network down...).
 */
function classifyGeminiError(err: unknown): GeminiErrorClass {
  const message = err instanceof Error ? err.message : "";

  // 429 from Gemini means quota exhaustion / rate limiting.
  if (err instanceof GoogleGenerativeAIFetchError && err.status === 429) return "quota";
  if (QUOTA_ERROR_RE.test(message)) return "quota";

  // HTTP 5xx (e.g. 503 UNAVAILABLE) are transient service faults.
  if (err instanceof GoogleGenerativeAIFetchError && err.status !== undefined) {
    if (err.status >= 500 && err.status < 600) return "transient";
  }
  if (TRANSIENT_ERROR_RE.test(message)) return "transient";

  return "fatal";
}

/**
 * Calls Gemini with retry logic for genuinely transient failures (HTTP 5xx /
 * temporary overload). Does NOT retry when the error means the project's Gemini
 * quota/rate limit is exhausted — a later attempt would just fail the same way,
 * so the error is thrown immediately with a clearly-labelled message.
 */
async function callGeminiWithRetry(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  parts: Parameters<typeof model.generateContent>[0],
  jobId: string,
) {
  const maxRetries = config.gemini.maxRetries;
  const retryDelay = config.gemini.retryDelayMs;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[extraction][${jobId}] Gemini API call attempt ${attempt}/${maxRetries + 1}`);
      const result = await model.generateContent(parts);
      return result;
    } catch (err: unknown) {
      const errorClass = classifyGeminiError(err);

      if (errorClass === "quota") {
        const detail = err instanceof Error ? err.message : "Unknown error";
        const status = err instanceof GoogleGenerativeAIFetchError ? err.status : undefined;
        throw new Error(
          `Gemini quota/rate-limit exhausted${status !== undefined ? ` (HTTP ${status})` : ""} for the project API key. ` +
          `Request was NOT retried. Details: ${detail}`
        );
      }

      if (errorClass === "transient" && attempt <= maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // exponential backoff
        console.warn(
          `[extraction][${jobId}] Transient Gemini error on attempt ${attempt}: ${(err as Error).message}. Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw err;
    }
  }
  // unreachable, but satisfies TS
  throw new Error("Exhausted retries");
}

export async function processExtraction(jobId: string): Promise<void> {
  const job = await db.job.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date(), attempts: { increment: 1 } },
    include: { note: true },
  });

  try {
    console.log(`[extraction][${jobId}] Starting. Note: ${job.noteId}, storageKey: ${job.note.storageKey}, mimeType: ${job.note.mimeType}`);

    const imageBuffer = await readUpload(job.note.storageKey);
    const base64Image = imageBuffer.toString("base64");
    console.log(`[extraction][${jobId}] Image loaded, base64 length: ${base64Image.length}`);

    const model = genAI.getGenerativeModel({
      model: config.gemini.extractionModel,
      generationConfig: {
        temperature: config.gemini.extractionTemperature,
        maxOutputTokens: config.gemini.extractionMaxOutputTokens,
        responseMimeType: "application/json",
      },
    });

    const result = await callGeminiWithRetry(
      model,
      [
        SYSTEM_PROMPT,
        {
          inlineData: {
            mimeType: job.note.mimeType,
            data: base64Image,
          },
        },
      ],
      jobId,
    );

    // --- Guard against truncated or empty responses ---
    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    console.log(`[extraction][${jobId}] finishReason: ${finishReason}`);
    console.log(`[extraction][${jobId}] usageMetadata: ${JSON.stringify(result.response.usageMetadata)}`);

    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        `Gemini response truncated (finishReason=MAX_TOKENS). ` +
        `Increase extractionMaxOutputTokens (currently ${config.gemini.extractionMaxOutputTokens}).`
      );
    }

    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
      throw new Error(`Gemini blocked the response (finishReason=${finishReason}).`);
    }

    const rawText = result.response.text();
    console.log(`[extraction][${jobId}] Raw text length: ${rawText.length}`);
    console.log(`[extraction][${jobId}] Raw text (first 500 chars): ${rawText.slice(0, 500)}`);

    if (!rawText || rawText.trim().length === 0) {
      throw new Error("Gemini returned an empty response (no text content in candidates).");
    }

    // --- Parse and validate ---
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(`[extraction][${jobId}] JSON.parse failed. Full raw text:\n${rawText}`);
      throw new Error(
        `JSON parse error: ${parseErr instanceof Error ? parseErr.message : parseErr}. ` +
        `Raw text (first 200 chars): ${rawText.slice(0, 200)}`
      );
    }

    const validated = extractionResultSchema.parse(parsedJson);
    console.log(`[extraction][${jobId}] Validated successfully. Title: "${validated.title}"`);

    await db.job.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date(), rawOutput: parsedJson as any },
    });

    await db.note.update({
      where: { id: job.noteId },
      data: {
        extractedTitle: validated.title,
        extractedBulletPoints: validated.bulletPoints,
        extractedActionItems: validated.actionItems,
        extractedDatesMentioned: validated.datesMentioned,
      },
    });

    console.log(`[extraction][${jobId}] ✅ COMPLETED`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[extraction][${jobId}] ❌ FAILED (attempt ${job.attempts + 1}): ${message}`);

    const errorClass = classifyGeminiError(err);
    // Quota/rate-limit exhaustion won't clear within a retry window — fail the
    // job now and record the reason rather than looping against the same 429.
    const jobFailsPermanently =
      errorClass === "quota" || job.attempts >= config.jobs.maxAttempts;

    if (jobFailsPermanently) {
      await db.job.update({
        where: { id: jobId },
        data: { status: "failed", error: message, completedAt: new Date() },
      });
    } else {
      // Brief delay before this job becomes eligible for retry again, so a
      // temporary overload on Gemini's side has a moment to clear rather
      // than the very next poll hitting the same spike immediately.
      if (errorClass === "transient") {
        await new Promise((r) => setTimeout(r, 5000));
      }
      await db.job.update({
        where: { id: jobId },
        data: { status: "pending", error: message },
      });
    }
    throw err;
  }
}
