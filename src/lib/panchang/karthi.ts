import { findTransition, jdToDate, normalizeLon } from './astronomy.js';
import { NAKSHATRA_DEG } from './constants.js';
import type { PanchangElement } from './types.js';

/**
 * Kārthi (కార్తె) — the Telugu agricultural calendar's solar nakṣatra: the
 * ~13-14 day period during which the sidereal Sun transits one of the 27
 * nakṣatras, named the same as the corresponding lunar nakṣatra (e.g. the
 * Sun in Rohiṇī is "Rohiṇī Kārthi"). Purely informational/seasonal — not
 * used anywhere in good-day scoring. See docs/PANCHANG_LOGIC.md §8.
 *
 * A 20-day search horizon comfortably covers the Sun's slowest transit
 * (~14 days, near aphelion in June-July) with margin, while staying well
 * short of the ~27-day gap to the *next* nakṣatra after that — so it can't
 * accidentally walk past the correct boundary.
 */
const KARTHI_HORIZON_DAYS = 20;

function karthiIndexAt(getSunLon: (jd: number) => number, jd: number): number {
  return Math.floor(normalizeLon(getSunLon(jd)) / NAKSHATRA_DEG) % 27;
}

/**
 * Backward search for where the current Kārthi segment began. Plain
 * bisection over the whole horizon — unlike `findSegmentStartBackward` in
 * astronomy.ts, which does a short linear scan tuned for the Moon's much
 * faster ~1-day nakṣatra segments and doesn't look back far enough for the
 * Sun's. Safe because the Sun's sidereal longitude is monotonically
 * increasing (never retrograde), so a single crossing exists in the window.
 */
function findKarthiStartBackward(
  jdAt: number,
  getSunLon: (jd: number) => number,
  currentIndex: number
): number {
  let lo = jdAt - KARTHI_HORIZON_DAYS;
  let hi = jdAt;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (karthiIndexAt(getSunLon, mid) === currentIndex) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Computes the Kārthi (solar nakṣatra) active at `jdRef`. */
export function computeKarthi(jdRef: number, getSunLon: (jd: number) => number): PanchangElement {
  const index = karthiIndexAt(getSunLon, jdRef);
  const startJd = findKarthiStartBackward(jdRef, getSunLon, index);
  const endJd = findTransition(
    jdRef,
    jdRef + KARTHI_HORIZON_DAYS,
    (jd) => normalizeLon(getSunLon(jd)),
    index,
    NAKSHATRA_DEG,
    27
  );
  return {
    index,
    nameKey: `karthi_${index}`,
    startTime: jdToDate(startJd),
    endTime: endJd ? jdToDate(endJd) : null,
  };
}
