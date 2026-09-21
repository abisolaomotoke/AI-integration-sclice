import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { withConcurrencyCap, currentActiveCount } from "@/lib/queue";
import { processExtraction } from "@/lib/jobs/processExtraction";

async function pollOnce(): Promise<void> {
  const capacity = config.jobs.maxConcurrency - currentActiveCount();
  if (capacity <= 0) return;

  const pendingJobs = await db.job.findMany({
    where: { status: "pending", type: "extraction" },
    orderBy: { createdAt: "asc" },
    take: capacity,
  });

  for (const job of pendingJobs) {
    withConcurrencyCap(async () => {
      try {
        await processExtraction(job.id);
      } catch (err) {
        console.error(`[worker] job ${job.id} failed:`, err);
      }
    });
  }
}

async function main(): Promise<void> {
  console.log(
    `[worker] started. Polling every ${config.jobs.pollIntervalMs}ms, concurrency cap ${config.jobs.maxConcurrency}.`
  );
  while (true) {
    await pollOnce();
    await new Promise((r) => setTimeout(r, config.jobs.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
