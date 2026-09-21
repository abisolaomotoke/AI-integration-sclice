require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const client = new PrismaClient({ adapter });

async function main() {
  const jobs = await client.job.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { note: true },
  });
  console.log(`Found ${jobs.length} jobs:`);
  for (const j of jobs) {
    console.log(JSON.stringify({
      id: j.id,
      type: j.type,
      status: j.status,
      attempts: j.attempts,
      error: j.error,
      noteId: j.noteId,
      storageKey: j.note ? j.note.storageKey : null,
      mimeType: j.note ? j.note.mimeType : null,
      rawOutput: j.rawOutput,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
    }, null, 2));
  }
}

main()
  .catch((err) => {
    console.error('Inspect failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
    await pool.end();
  });
