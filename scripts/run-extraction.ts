// Direct test: run processExtraction on a specific job, bypassing the worker polling loop.
import { processExtraction } from "@/lib/jobs/processExtraction";

const jobId = "cmu8wtarn000cd8i1yg7imhak";

console.log(`[test-run] Processing job ${jobId}...`);
processExtraction(jobId)
  .then(() => {
    console.log("[test-run] ✅ processExtraction completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[test-run] ❌ processExtraction threw:", err);
    process.exit(1);
  });
