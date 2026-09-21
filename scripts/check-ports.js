const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const s = net.createConnection(port, '127.0.0.1', () => {
      console.log(`Port ${port} is OPEN`);
      s.end();
      resolve(true);
    });
    s.setTimeout(2000, () => {
      console.log(`Port ${port} TIMEOUT`);
      s.destroy();
      resolve(false);
    });
    s.on('error', (e) => {
      console.log(`Port ${port} ERROR: ${e.message}`);
      resolve(false);
    });
  });
}

async function run() {
  await checkPort(5433);
  await checkPort(5432);
  process.exit(0);
}

run();
