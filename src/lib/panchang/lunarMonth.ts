import { normalizeLon } from './astronomy.js';
import { collectNewMoonRefinedJdsAlongAxis } from './newMoon.js';
import type { SunMoonLon } from './types.js';

const SUNSIGN_TO_AMANTA_BASE_LUNAR_MONTH: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

/**
 * Amānta lunar month via a sunsign lookup table, keyed off the Sun's rāśi at
 * the amāvāsyā that starts the current lunation (not the Sun's rāśi "now").
 * A lunation's shukla and kṛṣṇa pakṣas share one month name, but the Sun can
 * cross into the next rāśi partway through either pakṣa — keying off "now"
 * flips the name mid-lunation whenever that happens. Anchoring to the
 * lunation's own amāvāsyā keeps the name fixed for the whole month, which is
 * also why `paksham` is no longer needed here.
 *
 * This is still not saṅkrānti-counting Adhika/Kṣaya detection — see
 * docs/PANCHANG_LOGIC.md §4 for exactly what this does and doesn't cover.
 */
export function amantaLunarMonthIndexFromSunsignPakshaAndNm(
  jdStart: number,
  sunsign: number,
  _paksham: number,
  getSunMoon: (jd: number) => SunMoonLon
): number {
  const backward = collectNewMoonRefinedJdsAlongAxis(jdStart, getSunMoon, -1);
  const before = backward.filter((j) => j < jdStart);
  const prevAmavasyaJd = before.length > 0 ? Math.max(...before) : jdStart - 14.77;
  const sunAtAmavasya = normalizeLon(getSunMoon(prevAmavasyaJd + 0.5).sun);
  const sunsignAtAmavasya = Math.floor(sunAtAmavasya / 30) % 12;
  return SUNSIGN_TO_AMANTA_BASE_LUNAR_MONTH[sunsignAtAmavasya] ?? sunsign;
}
