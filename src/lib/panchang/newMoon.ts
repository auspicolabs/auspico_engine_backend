import { normalizeLon } from './astronomy.js';
import type { SunMoonLon } from './types.js';

function moonSunConjunctionSepDeg(jd: number, getSunMoon: (jd: number) => SunMoonLon): number {
  const { sun, moon } = getSunMoon(jd);
  const e = normalizeLon(moon - sun);
  return Math.min(e, 360 - e);
}

function refineMinimumUnimodal(
  jdLo: number,
  jdHi: number,
  f: (jd: number) => number,
  iterations: number
): number {
  for (let i = 0; i < iterations; i++) {
    const m1 = jdLo + (jdHi - jdLo) / 3;
    const m2 = jdHi - (jdHi - jdLo) / 3;
    if (f(m1) < f(m2)) jdHi = m2;
    else jdLo = m1;
  }
  return (jdLo + jdHi) / 2;
}

/**
 * Approximate new-moon (Sun–Moon conjunction) Julian days, walking forward or
 * backward from `jdRef` and refining each candidate by ternary-style search.
 */
export function collectNewMoonRefinedJdsAlongAxis(
  jdRef: number,
  getSunMoon: (jd: number) => SunMoonLon,
  direction: -1 | 1
): number[] {
  const sep = (t: number) => moonSunConjunctionSepDeg(t, getSunMoon);
  const step = 0.12;
  const horizon = 38;
  const jds: number[] = [];
  const n = Math.ceil(horizon / step);
  for (let k = 0; k <= n; k++) jds.push(jdRef + direction * k * step);
  const refined: number[] = [];
  for (let i = 1; i < jds.length - 1; i++) {
    const v = sep(jds[i]);
    if (v <= sep(jds[i - 1]) + 1e-6 && v <= sep(jds[i + 1]) + 1e-6 && v < 18) {
      const r = refineMinimumUnimodal(jds[i] - 1.5, jds[i] + 1.5, sep, 55);
      if (refined.length === 0 || Math.abs(r - refined[refined.length - 1]) > 0.45) refined.push(r);
    }
  }
  return refined;
}
