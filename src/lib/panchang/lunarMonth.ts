import { julianDayToDate } from '@swisseph/node';
import { collectNewMoonRefinedJdsAlongAxis } from './newMoon.js';
import type { SunMoonLon } from './types.js';

const SUNSIGN_TO_AMANTA_BASE_LUNAR_MONTH: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

/**
 * Amānta lunar month via a sunsign lookup table, with one special case for
 * the Mīna/Kṛṣṇa-pakṣa boundary. This is not saṅkrānti-counting Adhika/Kṣaya
 * detection — see docs/PANCHANG_LOGIC.md §4 for exactly what this does and
 * doesn't cover.
 */
export function amantaLunarMonthIndexFromSunsignPakshaAndNm(
  jdStart: number,
  sunsign: number,
  paksham: number,
  getSunMoon: (jd: number) => SunMoonLon
): number {
  const base = SUNSIGN_TO_AMANTA_BASE_LUNAR_MONTH[sunsign] ?? 0;
  if (paksham !== 1) return base;
  if (sunsign === 11) {
    const backward = collectNewMoonRefinedJdsAlongAxis(jdStart, getSunMoon, -1);
    const before = backward.filter((j) => j < jdStart);
    const nmBefore = before.length > 0 ? Math.max(...before) : jdStart - 14.77;
    const dt = julianDayToDate(nmBefore + 0.5);
    if (dt.month === 3) return base;
  }
  return (base + 11) % 12;
}
