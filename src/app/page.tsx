export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">AI Integration Slice</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Clean Next.js project initialized with TypeScript, Tailwind CSS, App Router, ESLint, and Design System Tokens.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2 text-xs font-mono text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
          Ready for feature development
        </div>
      </div>
    </main>
  );
}
