"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type JobStatus = "pending" | "processing" | "completed" | "failed";

interface NoteJob {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
}

interface NoteData {
  id: string;
  imageUrl: string;
  extractedTitle: string | null;
  extractedBulletPoints: string[] | null;
  extractedActionItems: string[] | null;
  extractedDatesMentioned: string[] | null;
  followUpAction: string | null;
  followUpResult: unknown;
  jobs: NoteJob[];
}

const STATUS_STYLES: Record<JobStatus, string> = {
  pending: "bg-surface-container text-on-surface-variant",
  processing: "bg-primary-container text-on-primary-container",
  completed: "bg-primary-container text-on-primary-container",
  failed: "bg-error-container text-error",
};

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState<
    "summarize" | "expand" | null
  >(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const loadNote = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/notes/${id}`);

    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Something went wrong loading this note.");
      setLoading(false);
      return;
    }

    const data: NoteData = await res.json();
    setNote(data);
    setError(null);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadNote();
      } catch {
        if (!cancelled) {
          setError("A network error occurred while loading this note.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNote]);

  const runFollowUp = useCallback(
    async (action: "summarize" | "expand"): Promise<void> => {
      setFollowUpLoading(action);
      setFollowUpError(null);

      let res: Response;
      try {
        res = await fetch(`/api/notes/${id}/follow-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      } catch {
        setFollowUpError("A network error occurred. Please try again.");
        setFollowUpLoading(null);
        return;
      }

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 429) {
        setFollowUpError("Too many requests. Try again shortly.");
        setFollowUpLoading(null);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setFollowUpError(data?.error ?? "Something went wrong.");
        setFollowUpLoading(null);
        return;
      }

      setFollowUpLoading(null);
      await loadNote();
    },
    [id, router, loadNote]
  );

  // While any job is still running, poll every 2s until all jobs settle.
  useEffect(() => {
    if (!note) return;

    const hasActiveJob = note.jobs.some(
      (job) => job.status === "pending" || job.status === "processing"
    );
    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      void loadNote();
    }, 2000);
    return () => clearInterval(interval);
  }, [note, loadNote]);

  const extractionJob =
    note?.jobs.find((job) => job.type === "extraction") ?? note?.jobs[0] ?? null;
  const extractionStatus = extractionJob?.status ?? "pending";
  const isCompleted = extractionStatus === "completed";
  const isFailed = extractionStatus === "failed";

  const followUpJob = note?.jobs.find((job) => job.type === "follow_up");
  const followUpStatus = followUpJob?.status ?? null;
  const followUpActive =
    followUpStatus === "pending" || followUpStatus === "processing";
  const followUpResult =
    typeof note?.followUpResult === "string" && note.followUpResult.length > 0
      ? (note.followUpResult as string)
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-[var(--spacing-xl)] py-[var(--spacing-2xl)]">
      {/* Navigation Header */}
      <div className="mb-[var(--spacing-xl)] flex items-center justify-between">
        <Link
          href="/dashboard"
          className="type-label-large2 flex items-center gap-[var(--spacing-xs)] text-on-surface-variant transition-colors hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {loading ? (
        <div
          className="rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)] text-center"
          style={{ boxShadow: "var(--shadow-soft-shadow)" }}
        >
          <p className="type-body-large2 text-on-surface-variant">Loading note…</p>
        </div>
      ) : notFound ? (
        <div
          className="rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)] text-center"
          style={{ boxShadow: "var(--shadow-soft-shadow)" }}
        >
          <p className="type-body-large2 text-on-surface-variant">
            This note could not be found.
          </p>
        </div>
      ) : error ? (
        <div
          className="rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)] text-center"
          style={{ boxShadow: "var(--shadow-soft-shadow)" }}
        >
          <p className="type-body-large2 text-error">{error}</p>
        </div>
      ) : note ? (
        <div className="grid gap-[var(--spacing-xl)] md:grid-cols-2">
          {/* Image Side */}
          <div
            className="rounded-lg overflow-hidden border border-outline-variant bg-surface-container-lowest"
            style={{ boxShadow: "var(--shadow-soft-shadow)" }}
          >
            <img
              src={note.imageUrl}
              alt="Uploaded handwritten note"
              className="h-auto w-full object-contain"
            />
          </div>

          {/* Content Side */}
          <div
            className="flex flex-col gap-[var(--spacing-lg)] rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)]"
            style={{ boxShadow: "var(--shadow-soft-shadow)" }}
          >
            <div className="flex items-center justify-between">
              <h1 className="type-headline-medium2 text-on-surface">Note</h1>
              <span
                className={`type-label-small2 rounded-full px-[var(--spacing-sm)] py-[var(--spacing-xs)] capitalize ${STATUS_STYLES[extractionStatus]}`}
              >
                {extractionStatus}
              </span>
            </div>

            {isFailed && extractionJob?.error && (
              <div className="rounded-md border border-error bg-error-container/20 p-[var(--spacing-md)]">
                <p className="type-body-small2 text-error">{extractionJob.error}</p>
              </div>
            )}

            {isCompleted && (
              <div className="flex flex-col gap-[var(--spacing-base)]">
                <h2 className="type-title-large2 text-on-surface">
                  {note.extractedTitle ?? "Untitled note"}
                </h2>

                {note.extractedBulletPoints &&
                note.extractedBulletPoints.length > 0 ? (
                  <div className="flex flex-col gap-[var(--spacing-xs)]">
                    <h3 className="type-label-large2 text-on-surface-variant">
                      Key Points
                    </h3>
                    <ul className="flex list-inside list-disc flex-col gap-[var(--spacing-xs)]">
                      {note.extractedBulletPoints.map((point, i) => (
                        <li key={i} className="type-body-medium2 text-on-surface">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {note.extractedActionItems &&
                note.extractedActionItems.length > 0 ? (
                  <div className="flex flex-col gap-[var(--spacing-xs)]">
                    <h3 className="type-label-large2 text-on-surface-variant">
                      Action Items
                    </h3>
                    <ul className="flex list-inside list-disc flex-col gap-[var(--spacing-xs)]">
                      {note.extractedActionItems.map((item, i) => (
                        <li key={i} className="type-body-medium2 text-on-surface">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {note.extractedDatesMentioned &&
                note.extractedDatesMentioned.length > 0 ? (
                  <div className="flex flex-col gap-[var(--spacing-xs)]">
                    <h3 className="type-label-large2 text-on-surface-variant">
                      Dates Mentioned
                    </h3>
                    <ul className="flex list-inside list-disc flex-col gap-[var(--spacing-xs)]">
                      {note.extractedDatesMentioned.map((date, i) => (
                        <li key={i} className="type-body-medium2 text-on-surface">
                          {date}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Follow-up actions */}
                <div className="mt-[var(--spacing-xs)] flex flex-col gap-[var(--spacing-base)] border-t border-outline-variant pt-[var(--spacing-lg)]">
                  <div className="flex items-center justify-between">
                    <h3 className="type-label-large2 text-on-surface-variant">
                      Follow-up
                    </h3>
                    {followUpStatus ? (
                      <span
                        className={`type-label-small2 rounded-full px-[var(--spacing-sm)] py-[var(--spacing-xs)] capitalize ${STATUS_STYLES[followUpStatus]}`}
                      >
                        {followUpStatus}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-[var(--spacing-base)]">
                    <button
                      type="button"
                      disabled={followUpActive || followUpLoading !== null}
                      onClick={() => void runFollowUp("summarize")}
                      className="type-button2 rounded-md bg-primary px-[var(--spacing-base)] py-[var(--spacing-sm)] text-white transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {followUpLoading === "summarize"
                        ? "Summarizing…"
                        : "Summarize"}
                    </button>
                    <button
                      type="button"
                      disabled={followUpActive || followUpLoading !== null}
                      onClick={() => void runFollowUp("expand")}
                      className="type-button2 rounded-md border border-outline px-[var(--spacing-base)] py-[var(--spacing-sm)] text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {followUpLoading === "expand" ? "Expanding…" : "Expand"}
                    </button>
                  </div>

                  {followUpError ? (
                    <div className="rounded-md border border-error bg-error-container/20 p-[var(--spacing-md)]">
                      <p className="type-body-small2 text-error">
                        {followUpError}
                      </p>
                    </div>
                  ) : null}

                  {followUpStatus === "failed" && followUpJob?.error ? (
                    <div className="rounded-md border border-error bg-error-container/20 p-[var(--spacing-md)]">
                      <p className="type-body-small2 text-error">
                        {followUpJob.error}
                      </p>
                    </div>
                  ) : null}

                  {followUpActive ? (
                    <p className="type-body-medium2 text-on-surface-variant">
                      {note.followUpAction === "expand"
                        ? "Expanding note…"
                        : "Summarizing note…"}
                    </p>
                  ) : null}

                  {followUpResult ? (
                    <div className="rounded-md border border-outline-variant bg-surface-container p-[var(--spacing-base)]">
                      <h3 className="type-label-large2 mb-[var(--spacing-xs)] text-on-surface-variant">
                        {note.followUpAction === "expand" ? "Expanded" : "Summary"}
                      </h3>
                      <p className="type-body-medium2 whitespace-pre-line text-on-surface">
                        {followUpResult}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {!isCompleted && !isFailed && (
              <p className="type-body-medium2 text-on-surface-variant">
                AI extraction is in progress. This page refreshes automatically.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}