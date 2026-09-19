import Fastify from 'fastify';
import cors from '@fastify/cors';
import { festivalRoutes } from './routes/festivals.js';
import { panchangRoutes } from './routes/panchang.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  await app.register(cors, { origin: true });
  await app.register(panchangRoutes);
  await app.register(festivalRoutes);

  app.get('/api/v1/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'auspico-engine',
    version: '1.0.0',
  }));

  return app;
}
