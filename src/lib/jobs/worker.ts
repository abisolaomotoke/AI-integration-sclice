import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { withConcurrencyCap, currentActiveCount } from "@/lib/queue";
import { processExtraction } from "@/lib/jobs/processExtraction";
import { processFollowUp } from "@/lib/jobs/processFollowUp";

async function pollOnce(): Promise<void> {
  const capacity = config.jobs.maxConcurrency - currentActiveCount();
  if (capacity <= 0) return;

  const pendingJobs = await db.job.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: capacity,
  });

  for (const job of pendingJobs) {
    withConcurrencyCap(async () => {
      try {
        if (job.type === "extraction") {
          await processExtraction(job.id);
        } else {
          await processFollowUp(job.id);
        }
      } catch (err) {
        console.error(`[worker] job ${job.id} (${job.type}) failed:`, err);
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
