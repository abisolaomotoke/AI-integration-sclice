import { db } from "@/lib/db";
import { genAI } from "@/lib/gemini";
import { config } from "@/lib/config";
import { followUpResultSchema } from "@/lib/schemas";

const SYSTEM_PROMPT = `You take already-structured notes (title, bullet points,
action items, dates) and either summarize or expand them, as instructed.
Summarize: produce a tight 2-4 sentence prose summary of the note's content
and any action items, suitable for someone who will not read the original.
Expand: take the bullet points and action items and write them out as full
prose paragraphs, adding connective explanation between related points
without inventing new facts that were not in the original bullets.
Respond with ONLY valid JSON matching this exact shape, no other text:
{ "action": "summarize" | "expand", "result": string }`;

export async function processFollowUp(jobId: string): Promise<void> {
  const job = await db.job.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date(), attempts: { increment: 1 } },
    include: { note: true },
  });

  const action = job.note.followUpAction as "summarize" | "expand" | null;
  if (!action) {
    await db.job.update({
      where: { id: jobId },
      data: { status: "failed", error: "No follow-up action set on note.", completedAt: new Date() },
    });
    return;
  }

  try {
    const noteContent = JSON.stringify({
      title: job.note.extractedTitle,
      bulletPoints: job.note.extractedBulletPoints,
      actionItems: job.note.extractedActionItems,
      datesMentioned: job.note.extractedDatesMentioned,
    });

    const model = genAI.getGenerativeModel({
      model: config.gemini.followUpModel,
      generationConfig: {
        temperature: config.gemini.followUpTemperature,
        maxOutputTokens: config.gemini.followUpMaxOutputTokens,
        responseMimeType: "application/json",
        // @ts-expect-error thinkingConfig exists at runtime but is untyped in this SDK version
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      `Action: ${action}\n\nStructured note:\n${noteContent}`,
    ]);

    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        "Response was truncated because it exceeded the token limit before completing."
      );
    }

    const rawText = result.response.text();
    const parsedJson = JSON.parse(rawText);
    const validated = followUpResultSchema.parse(parsedJson);

    await db.job.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date(), rawOutput: parsedJson },
    });

    await db.note.update({
      where: { id: job.noteId },
      data: { followUpResult: validated.result },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isTemporary = /503|overloaded|high demand|UNAVAILABLE/i.test(message);
    if (job.attempts >= config.jobs.maxAttempts) {
      await db.job.update({
        where: { id: jobId },
        data: { status: "failed", error: message, completedAt: new Date() },
      });
    } else {
      if (isTemporary) {
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