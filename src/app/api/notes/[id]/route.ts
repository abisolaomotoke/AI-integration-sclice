import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/notes/[id]">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const note = await db.note.findFirst({
    where: { id, userId: user.id },
    include: {
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: note.id,
    imageUrl: `/uploads/${note.storageKey}`,
    extractedTitle: note.extractedTitle,
    extractedBulletPoints: note.extractedBulletPoints,
    extractedActionItems: note.extractedActionItems,
    extractedDatesMentioned: note.extractedDatesMentioned,
    followUpAction: note.followUpAction,
    followUpResult: note.followUpResult,
    jobs: note.jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      error: job.error,
      createdAt: job.createdAt,
    })),
  });
}