import { buildApp } from './app.js';

const PORT = Number(process.env.PORT) || 3010;

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Auspico engine running at http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
