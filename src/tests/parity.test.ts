import assert from 'node:assert/strict';
import { computePanchang as computeAuspico, ruthuvuIndexFromSunsign } from '../lib/panchang/index.js';

const cases = [
  { date: '2026-04-17', lat: 17.385, lon: 78.4867, tz: 'Asia/Kolkata' },
  { date: '2026-03-29', lat: 17.385, lon: 78.4867, tz: 'Asia/Kolkata' },
  { date: '2026-01-01', lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
];

function run() {
  for (const c of cases) {
    const a = computeAuspico(c.date, c.lat, c.lon, c.tz, 'lahiri');

    // Self-contained invariants for core engine outputs.
    assert.ok(a.tithi.index >= 0 && a.tithi.index <= 29, `${c.date} tithi index range`);
    assert.ok(a.nakshatra.index >= 0 && a.nakshatra.index <= 26, `${c.date} nakshatra index range`);
    assert.ok(a.yoga.index >= 0 && a.yoga.index <= 26, `${c.date} yoga index range`);
    assert.ok(a.vara >= 0 && a.vara <= 6, `${c.date} vara range`);
    assert.ok(a.paksham === 0 || a.paksham === 1, `${c.date} paksham enum`);
    assert.ok(a.sunsign >= 0 && a.sunsign <= 11, `${c.date} sunsign range`);
    assert.ok(a.moonsign >= 0 && a.moonsign <= 11, `${c.date} moonsign range`);
    assert.ok(a.lunarMonthIndex >= 0 && a.lunarMonthIndex <= 11, `${c.date} lunar month range`);
    assert.ok(a.ruthuvuIndex >= 0 && a.ruthuvuIndex <= 5, `${c.date} ruthuvu range`);
    assert.equal(a.kaalams.length, 3, `${c.date} kaalams length`);
    assert.ok(Array.isArray(a.durmuhurtham), `${c.date} durmuhurtham array`);
    assert.ok(Array.isArray(a.amrutaGhadiyalu), `${c.date} amrutaGhadiyalu array`);
  }

  // Vasanta ṛtu pairs Mīna (11) + Meṣa (0), not Meṣa + Vṛṣabha (0,1).
  assert.equal(ruthuvuIndexFromSunsign(11), 0, 'Mīna → Vasanta');
  assert.equal(ruthuvuIndexFromSunsign(0), 0, 'Meṣa → Vasanta');
  assert.equal(ruthuvuIndexFromSunsign(1), 1, 'Vṛṣabha → Grishma');
  assert.equal(ruthuvuIndexFromSunsign(10), 5, 'Kumbha → Shishira');

  console.log('Auspico engine invariant tests passed');
}

run();
