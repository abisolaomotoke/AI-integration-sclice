require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const client = new PrismaClient({ adapter });

async function main() {
  console.log('Testing Prisma database connection...');
  const count = await client.job.count();
  console.log('Initial job count:', count);

  // Test creating a job record
  const testJob = await client.job.create({
    data: {
      status: 'PENDING',
      inputFile: 'sample-document.pdf',
      inputData: JSON.stringify({ action: 'summarize', model: 'gemini-pro' }),
    },
  });
  console.log('Created test job:', testJob.id, testJob.status, testJob.inputFile);

  // Test querying the record
  const fetched = await client.job.findUnique({
    where: { id: testJob.id },
  });
  console.log('Fetched test job:', fetched?.id, fetched?.status);

  // Test updating the status (e.g. PROCESSING -> COMPLETED)
  const updated = await client.job.update({
    where: { id: testJob.id },
    data: {
      status: 'COMPLETED',
      result: JSON.stringify({ summary: 'Analysis completed successfully.' }),
    },
  });
  console.log('Updated test job status:', updated.status, 'Result:', updated.result);

  // Clean up
  await client.job.delete({
    where: { id: testJob.id },
  });
  console.log('Cleaned up test job. Verification SUCCESSFUL!');
}

main()
  .catch((err) => {
    console.error('Database verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
  });
