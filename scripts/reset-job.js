require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const client = new PrismaClient({ adapter });

async function main() {
  // Reset the latest failed job to pending so the worker can retry it
  const jobId = 'cmu8wtarn000cd8i1yg7imhak';
  const updated = await client.job.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      error: null,
      attempts: 0,
      completedAt: null,
      startedAt: null,
    },
  });
  console.log('Reset job to pending:', updated.id, updated.status, 'attempts:', updated.attempts);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await client.$disconnect(); await pool.end(); });
