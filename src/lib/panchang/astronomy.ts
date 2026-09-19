import {
  dateToJulianDay,
  julianDayToDate,
  calculateRiseTransitSet,
  Planet,
  RiseTransitFlag,
} from '@swisseph/node';
import { calendarDateKeyInTz, midnightInTz } from '../timezone.js';
import { TROPICAL_FLAGS } from './constants.js';
import type { SunriseSunset, MoonriseMoonset } from './types.js';

export function jdToDate(jd: number): Date {
  const dt = julianDayToDate(jd);
  const dayMs = Date.UTC(dt.year, dt.month - 1, dt.day, 0, 0, 0, 0);
  const hourMs = (dt.hour ?? 0) * 3600 * 1000;
  return new Date(dayMs + hourMs);
}

export function normalizeLon(lon: number): number {
  let l = lon % 360;
  if (l < 0) l += 360;
  return l;
}

export function getSunriseSunset(dateStr: string, lat: number, lon: number, tz: string): SunriseSunset {
  const localMidnight = midnightInTz(dateStr, tz);
  const jdStart = dateToJulianDay(localMidnight) - 0.5;

  const sunrise = calculateRiseTransitSet(
    jdStart,
    Planet.Sun,
    RiseTransitFlag.Rise,
    lon,
    lat,
    0,
    TROPICAL_FLAGS
  );
  const sunriseJd = sunrise.time;
  const sunset = calculateRiseTransitSet(
    sunriseJd,
    Planet.Sun,
    RiseTransitFlag.Set,
    lon,
    lat,
    0,
    TROPICAL_FLAGS
  );

  return {
    sunrise: jdToDate(sunriseJd),
    sunset: jdToDate(sunset.time),
  };
}

function collectRiseTransitSequence(
  planet: Planet,
  event: RiseTransitFlag.Rise | RiseTransitFlag.Set,
  jdFrom: number,
  jdTo: number,
  lon: number,
  lat: number,
  maxEvents: number
): number[] {
  const out: number[] = [];
  let jd = jdFrom;
  for (let i = 0; i < maxEvents && jd < jdTo; i++) {
    try {
      const r = calculateRiseTransitSet(jd, planet, event, lon, lat, 0, TROPICAL_FLAGS);
      if (!Number.isFinite(r.time)) break;
      if (r.time <= jd) {
        jd += 1e-5;
        continue;
      }
      if (r.time >= jdTo) break;
      out.push(r.time);
      jd = r.time + 1e-7;
    } catch {
      break;
    }
  }
  return out;
}

export function getMoonriseMoonset(dateStr: string, lat: number, lon: number, tz: string): MoonriseMoonset {
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDateStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const thisMid = midnightInTz(dateStr, tz);
  const nextMid = midnightInTz(nextDateStr, tz);
  const jdWindowStart = dateToJulianDay(thisMid) - 1;
  const jdWindowEnd = dateToJulianDay(nextMid) + 1;

  const riseJds = collectRiseTransitSequence(
    Planet.Moon,
    RiseTransitFlag.Rise,
    jdWindowStart,
    jdWindowEnd,
    lon,
    lat,
    8
  );
  const setJds = collectRiseTransitSequence(
    Planet.Moon,
    RiseTransitFlag.Set,
    jdWindowStart,
    jdWindowEnd,
    lon,
    lat,
    8
  );
  const onDay = (jd: number) => calendarDateKeyInTz(jdToDate(jd), tz) === dateStr;
  const risesToday = riseJds.filter(onDay);
  const setsToday = setJds.filter(onDay);

  return {
    moonrise: risesToday.length > 0 ? jdToDate(Math.min(...risesToday)) : null,
    moonset: setsToday.length > 0 ? jdToDate(Math.min(...setsToday)) : null,
  };
}

/**
 * Binary search for the Julian day where a cyclic quantity (tithi, nakṣatra,
 * yoga, karaṇa step, ...) next crosses into the following `step`-sized index,
 * between `jdStart` (must be inside `currentIndex`) and `jdEnd`.
 */
export function findTransition(
  jdStart: number,
  jdEnd: number,
  getValue: (jd: number) => number,
  currentIndex: number,
  step: number,
  total: number
): number | null {
  const nextIndex = (currentIndex + 1) % total;
  const idxAt = (jd: number) => Math.floor(getValue(jd) / step) % total;
  if (idxAt(jdStart) !== currentIndex) return null;
  let lo = jdStart;
  let hi = jdEnd;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const idx = idxAt(mid);
    if (idx === nextIndex) hi = mid;
    else lo = mid;
  }
  if (hi <= jdStart || hi > jdEnd) return null;
  return idxAt(hi) === nextIndex ? hi : null;
}

/** The counterpart to `findTransition`: finds where the *current* segment began, looking up to 3 days back. */
export function findSegmentStartBackward(
  jdAt: number,
  getValue: (jd: number) => number,
  currentIndex: number,
  step: number,
  total: number
): number {
  let hi = jdAt;
  let lo = jdAt;
  const stepDays = 1 / 24;
  const maxLookbackDays = 3;
  const maxSteps = Math.ceil(maxLookbackDays / stepDays);

  for (let i = 0; i < maxSteps; i++) {
    const probe = hi - stepDays;
    const idx = Math.floor(getValue(probe) / step) % total;
    if (idx !== currentIndex) {
      lo = probe;
      break;
    }
    hi = probe;
    lo = probe;
  }

  const loIdx = Math.floor(getValue(lo) / step) % total;
  if (loIdx === currentIndex) return jdAt;

  let left = lo;
  let right = jdAt;
  for (let i = 0; i < 50; i++) {
    const mid = (left + right) / 2;
    const idx = Math.floor(getValue(mid) / step) % total;
    if (idx === currentIndex) right = mid;
    else left = mid;
  }
  return right;
}

export function weekdayInTz(date: Date, tz: string): number {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? date.getUTCDay();
}
