import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const notes = await db.note.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-[var(--spacing-xl)] py-[var(--spacing-2xl)]">
      {/* Header */}
      <header className="mb-[var(--spacing-2xl)] flex items-center justify-between border-b border-outline-variant pb-[var(--spacing-base)]">
        <div>
          <h1 className="type-headline-medium2 text-on-surface">Dashboard</h1>
          <p className="type-body-medium2 text-on-surface-variant">{user.email}</p>
        </div>
        <LogoutButton />
      </header>

      {/* Notes section heading + upload CTA */}
      <div className="mb-[var(--spacing-lg)] flex items-center justify-between">
        <h2 className="type-title-large2 text-on-surface">Notes</h2>
        <Link
          href="/upload"
          className="type-button2 rounded-md bg-primary px-[var(--spacing-base)] py-[var(--spacing-sm)] text-white transition-colors hover:bg-secondary"
        >
          Upload a note
        </Link>
      </div>

      {/* Notes list or empty state */}
      {notes.length === 0 ? (
        <div
          className="rounded-lg bg-surface-container-lowest p-[var(--spacing-2xl)] text-center"
          style={{ boxShadow: "var(--shadow-soft-shadow)" }}
        >
          <p className="type-body-large2 text-on-surface-variant">
            No notes yet. Upload a photo of a handwritten note to get started.
          </p>
        </div>
      ) : (
        <ul
          className="flex flex-col divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant"
          style={{ boxShadow: "var(--shadow-soft-shadow)" }}
        >
          {notes.map((note) => {
            const latestJob = note.jobs[0];
            const status = latestJob ? latestJob.status : "pending";

            return (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="flex items-center justify-between bg-surface-container-lowest px-[var(--spacing-base)] py-[var(--spacing-md)] transition-colors hover:bg-surface-container-low"
                >
                  <span className="type-body-large2 text-on-surface">
                    {note.extractedTitle ?? "Untitled note"}
                  </span>
                  <span className="type-label-small2 rounded-full bg-primary-container px-[var(--spacing-sm)] py-[var(--spacing-xs)] capitalize text-on-primary-container">
                    {status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
