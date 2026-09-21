import { config } from "@/lib/config";

let active = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (active < config.jobs.maxConcurrency) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
}

function releaseSlot(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

export async function withConcurrencyCap<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

export function currentActiveCount(): number {
  return active;
}
