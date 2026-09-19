import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import { config } from "@/lib/config";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const rate = checkRateLimit(
    `upload:${user.id}`,
    config.rateLimit.upload.windowMs,
    config.rateLimit.upload.max
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!config.uploads.allowedMimeTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use JPEG, PNG, or WebP.` },
      { status: 400 }
    );
  }

  if (file.size > config.uploads.maxFileSizeBytes) {
    return NextResponse.json(
      {
        error: `File too large. Max size is ${config.uploads.maxFileSizeBytes / (1024 * 1024)}MB.`,
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = await saveUpload(user.id, buffer, file.type);

  const note = await db.note.create({
    data: {
      userId: user.id,
      storageKey,
      mimeType: file.type,
    },
  });

  const job = await db.job.create({
    data: { noteId: note.id, type: "extraction", status: "pending" },
  });

  return NextResponse.json({ noteId: note.id, jobId: job.id }, { status: 202 });
}
