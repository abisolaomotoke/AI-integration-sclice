import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { config } from "@/lib/config";
import { checkRateLimit } from "@/lib/rateLimit";

const followUpRequestSchema = z.object({
  action: z.enum(["summarize", "expand"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const rate = checkRateLimit(
    `followup:${user.id}`,
    config.rateLimit.followUp.windowMs,
    config.rateLimit.followUp.max
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = followUpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const note = await db.note.findFirst({
    where: { id, userId: user.id },
  });
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  if (!note.extractedTitle) {
    return NextResponse.json(
      { error: "Note has not finished extraction yet." },
      { status: 409 }
    );
  }

  await db.note.update({
    where: { id: note.id },
    data: { followUpAction: parsed.data.action },
  });

  const job = await db.job.create({
    data: { noteId: note.id, type: "follow_up", status: "pending" },
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}