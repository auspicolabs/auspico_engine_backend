import assert from 'node:assert/strict';
import { buildApp } from '../app.js';

async function run() {
  const app = await buildApp();
  await app.ready();

  const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
  assert.equal(health.statusCode, 200);
  const healthBody = health.json();
  assert.equal(healthBody.status, 'ok');
  assert.equal(healthBody.service, 'auspico-engine');

  const dateResp = await app.inject({
    method: 'GET',
    url: '/api/v1/panchang/date?date=2026-04-17&lat=17.385&lon=78.4867&tz=Asia/Kolkata&ayanamsa=lahiri',
  });
  assert.equal(dateResp.statusCode, 200);
  const dateBody = dateResp.json();
  assert.ok(dateBody.meta?.version, 'meta.version required');
  assert.ok(dateBody.core?.sunrise, 'core.sunrise required');
  assert.ok(Array.isArray(dateBody.core?.kaalams), 'core.kaalams must be array');
  assert.ok('tithi' in dateBody.core, 'core.tithi required');
  assert.ok('durmuhurtham' in dateBody.core, 'core.durmuhurtham required');

  const rangeResp = await app.inject({
    method: 'GET',
    url: '/api/v1/panchang/range?start=2026-04-15&end=2026-04-17&lat=17.385&lon=78.4867&tz=Asia/Kolkata',
  });
  assert.equal(rangeResp.statusCode, 200);
  const rangeBody = rangeResp.json();
  assert.equal(rangeBody.days.length, 3, 'range should include 3 days');
  assert.equal(rangeBody.days[0].core.date, '2026-04-15');

  const invalidResp = await app.inject({
    method: 'GET',
    url: '/api/v1/panchang/date?date=2026-04-17&lat=500&lon=78.4867&tz=Asia/Kolkata',
  });
  assert.equal(invalidResp.statusCode, 400);
  assert.equal(invalidResp.json().code, 'INVALID_LAT');

  await app.close();
  console.log('Auspico contract tests passed');
}

run();
