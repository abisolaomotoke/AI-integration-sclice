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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12">
      <header className="mb-8 flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-stone-600">{user.email}</p>
        </div>
        <LogoutButton />
      </header>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium">Notes</h2>
        <Link
          href="/upload"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Upload a note
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-stone-600">
          No notes yet. Upload a photo of a handwritten note to get started.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-200 rounded-md border border-stone-200">
          {notes.map((note) => {
            const latestJob = note.jobs[0];
            const status = latestJob ? latestJob.status : "pending";

            return (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                >
                  <span className="text-sm font-medium text-stone-900">
                    {note.extractedTitle ?? "Untitled note"}
                  </span>
                  <span className="text-xs capitalize text-stone-500">
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
