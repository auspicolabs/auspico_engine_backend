import { dateToJulianDay, calculatePosition, Planet } from '@swisseph/node';
import {
  SIDEREAL_FLAGS,
  TITHI_DEG,
  NAKSHATRA_DEG,
  YOGA_DEG,
  GHATIKA_MINUTES,
  VARJAM_DURATION_MINUTES,
  AMRITA_DURATION_FACTOR,
  NAKSHATRA_THYAJYA_GHATIKA_OFFSETS,
  NAKSHATRA_AMRITA_START_HOURS,
} from './constants.js';
import {
  jdToDate,
  normalizeLon,
  getSunriseSunset,
  getMoonriseMoonset,
  findTransition,
  findSegmentStartBackward,
  weekdayInTz,
} from './astronomy.js';
import { amantaLunarMonthIndexFromSunsignPakshaAndNm } from './lunarMonth.js';
import { ruthuvuIndexFromPanchang } from './ruthuvu.js';
import { karanaIndexFromStep } from './karana.js';
import { durmuhurtamRanges, computeKaalams } from './kaalams.js';
import { setSiderealModeFromQuery } from './ayanamsa.js';
import type { PanchangElement, PanchangResult, SunMoonLon, TimeRange } from './types.js';

// Public surface of the panchang engine — everything a caller needs is
// re-exported from here, from whichever module actually implements it.
export type {
  SunriseSunset,
  MoonriseMoonset,
  PanchangElement,
  Kaalam,
  TimeRange,
  PanchangResult,
} from './types.js';
export { getSunriseSunset, getMoonriseMoonset } from './astronomy.js';
export { ruthuvuIndexFromSunsign, ruthuvuIndexFromPanchang } from './ruthuvu.js';

/**
 * Computes a full day's panchang for `dateStr` (local calendar date) at the
 * given location, for the sunrise → next-sunrise window. See
 * docs/PANCHANG_LOGIC.md for what each field means and how it's derived.
 */
export function computePanchang(
  dateStr: string,
  lat: number,
  lon: number,
  tz: string,
  ayanamsa: string = 'lahiri'
): PanchangResult {
  // setSiderealMode is process-global. Safe only because this function and
  // every Swiss Ephemeris call below it are fully synchronous (no await) —
  // if that ever changes, concurrent requests with different `ayanamsa`
  // values can interleave and read the wrong sidereal mode. See
  // docs/roadmap/PANCHANG_LOGIC_FUTURE.md §5.
  setSiderealModeFromQuery(ayanamsa);

  const { sunrise, sunset } = getSunriseSunset(dateStr, lat, lon, tz);
  const { moonrise, moonset } = getMoonriseMoonset(dateStr, lat, lon, tz);
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDateStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const { sunrise: nextSunrise } = getSunriseSunset(nextDateStr, lat, lon, tz);

  const jdStart = dateToJulianDay(sunrise);
  const jdEnd = dateToJulianDay(nextSunrise);

  const getSunMoon = (jd: number): SunMoonLon => {
    const sun = calculatePosition(jd, Planet.Sun, SIDEREAL_FLAGS);
    const moon = calculatePosition(jd, Planet.Moon, SIDEREAL_FLAGS);
    return { sun: sun.longitude, moon: moon.longitude };
  };

  const tithiValue = (jd: number) => normalizeLon(getSunMoon(jd).moon - getSunMoon(jd).sun);
  const nakshatraValue = (jd: number) => normalizeLon(getSunMoon(jd).moon);
  const yogaValue = (jd: number) => normalizeLon(getSunMoon(jd).sun + getSunMoon(jd).moon);
  const karanaStepValue = (jd: number) => Math.floor(tithiValue(jd) / 6) % 60;

  const tithiAtStart = Math.floor(tithiValue(jdStart) / TITHI_DEG) % 30;
  const nakshatraAtStart = Math.floor(nakshatraValue(jdStart) / NAKSHATRA_DEG) % 27;
  const yogaAtStart = Math.floor(yogaValue(jdStart) / YOGA_DEG) % 27;
  const karanaStepAtStart = Math.floor(tithiValue(jdStart) / 6) % 60;

  const tithiStartJd = findSegmentStartBackward(jdStart, tithiValue, tithiAtStart, TITHI_DEG, 30);
  const nakshatraStartJd = findSegmentStartBackward(
    jdStart,
    nakshatraValue,
    nakshatraAtStart,
    NAKSHATRA_DEG,
    27
  );
  const yogaStartJd = findSegmentStartBackward(jdStart, yogaValue, yogaAtStart, YOGA_DEG, 27);

  const tithiEndJd = findTransition(jdStart, jdEnd, tithiValue, tithiAtStart, TITHI_DEG, 30);
  const nakshatraEndJd = findTransition(jdStart, jdEnd, nakshatraValue, nakshatraAtStart, NAKSHATRA_DEG, 27);
  const yogaEndJd = findTransition(jdStart, jdEnd, yogaValue, yogaAtStart, YOGA_DEG, 27);

  const paksham = tithiAtStart < 15 ? 0 : 1;
  const dayDuration = (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
  const partDuration = dayDuration / 8;
  const weekday = weekdayInTz(sunrise, tz);

  const { sun: sunLon, moon: moonLon } = getSunMoon(jdStart);
  const moonsign = Math.floor(normalizeLon(moonLon) / 30) % 12;
  const sunsign = Math.floor(normalizeLon(sunLon) / 30) % 12;
  const lunarMonthIndex = amantaLunarMonthIndexFromSunsignPakshaAndNm(jdStart, sunsign, paksham, getSunMoon);
  const ruthuvuIndex = ruthuvuIndexFromPanchang(sunsign, lunarMonthIndex);

  const solarNoonMs = (sunrise.getTime() + sunset.getTime()) / 2;
  const abhijit24MinMs = 24 * 60 * 1000;
  const abhijit: TimeRange = {
    start: new Date(solarNoonMs - abhijit24MinMs),
    end: new Date(solarNoonMs + abhijit24MinMs),
  };
  const brahmaMuhurtam: TimeRange = {
    start: new Date(sunrise.getTime() - 96 * 60 * 1000),
    end: new Date(sunrise.getTime() - 48 * 60 * 1000),
  };

  const kaalams = computeKaalams(weekday, sunrise, partDuration);
  const durmuhurtham = durmuhurtamRanges(sunrise, sunset, weekday);

  // Walk every nakṣatra segment across the day window once; amṛta ghaṭiyalu
  // and varjyam are both derived from these same segments below.
  const nakshatraSegments: { idx: number; startJd: number; endJd: number }[] = [];
  let walkNakIdx = nakshatraAtStart;
  let walkSegStartJd = findSegmentStartBackward(jdStart, nakshatraValue, nakshatraAtStart, NAKSHATRA_DEG, 27);
  while (walkSegStartJd < jdEnd) {
    const walkSegEndJd =
      findTransition(walkSegStartJd, jdEnd, nakshatraValue, walkNakIdx, NAKSHATRA_DEG, 27) ?? jdEnd;
    nakshatraSegments.push({ idx: walkNakIdx, startJd: walkSegStartJd, endJd: walkSegEndJd });
    if (walkSegEndJd >= jdEnd) break;
    walkSegStartJd = walkSegEndJd;
    walkNakIdx = (walkNakIdx + 1) % 27;
  }

  const amrutaGhadiyalu: TimeRange[] = [];
  for (const seg of nakshatraSegments) {
    const segDuration = seg.endJd - seg.startJd;
    if (segDuration <= 0) continue;
    const amritaX = NAKSHATRA_AMRITA_START_HOURS[seg.idx] ?? 0;
    const amritaStartJd = seg.startJd + (amritaX / 24) * segDuration;
    const amritaEndJd = amritaStartJd + AMRITA_DURATION_FACTOR * segDuration;
    const clippedStart = Math.max(jdStart, amritaStartJd);
    const clippedEnd = Math.min(jdEnd, amritaEndJd);
    if (clippedEnd > clippedStart)
      amrutaGhadiyalu.push({ start: jdToDate(clippedStart), end: jdToDate(clippedEnd) });
  }

  const varjamDurationInDays = VARJAM_DURATION_MINUTES / (24 * 60);
  let varjam: TimeRange | null = null;
  for (const seg of nakshatraSegments) {
    const ghatikaOffset = NAKSHATRA_THYAJYA_GHATIKA_OFFSETS[seg.idx] ?? 0;
    const varjamStartJd = seg.startJd + (ghatikaOffset * GHATIKA_MINUTES) / (24 * 60);
    const varjamEndJd = varjamStartJd + varjamDurationInDays;
    const clippedStart = Math.max(jdStart, varjamStartJd);
    const clippedEnd = Math.min(jdEnd, varjamEndJd);
    if (clippedEnd > clippedStart) {
      varjam = { start: jdToDate(clippedStart), end: jdToDate(clippedEnd) };
      break;
    }
  }

  const karanas: PanchangElement[] = [];
  let step = karanaStepAtStart;
  let jdFrom = jdStart;
  let segmentStartJd = findSegmentStartBackward(jdStart, karanaStepValue, step, 1, 60);
  while (jdFrom < jdEnd) {
    const karanaEndJd = findTransition(jdFrom, jdEnd, karanaStepValue, step, 1, 60);
    const idx = karanaIndexFromStep(step);
    karanas.push({
      index: idx,
      nameKey: `karana_${idx}`,
      startTime: jdToDate(segmentStartJd),
      endTime: karanaEndJd ? jdToDate(karanaEndJd) : null,
    });
    if (!karanaEndJd) break;
    step = (step + 1) % 60;
    jdFrom = karanaEndJd;
    segmentStartJd = karanaEndJd;
  }

  return {
    date: dateStr,
    sunrise,
    sunset,
    moonrise,
    moonset,
    tithi: {
      index: tithiAtStart,
      nameKey: `tithi_${tithiAtStart}`,
      startTime: jdToDate(tithiStartJd),
      endTime: tithiEndJd ? jdToDate(tithiEndJd) : null,
    },
    nakshatra: {
      index: nakshatraAtStart,
      nameKey: `nakshatra_${nakshatraAtStart}`,
      startTime: jdToDate(nakshatraStartJd),
      endTime: nakshatraEndJd ? jdToDate(nakshatraEndJd) : null,
    },
    yoga: {
      index: yogaAtStart,
      nameKey: `yoga_${yogaAtStart}`,
      startTime: jdToDate(yogaStartJd),
      endTime: yogaEndJd ? jdToDate(yogaEndJd) : null,
    },
    karanas,
    kaalams,
    vara: weekday,
    paksham,
    moonsign,
    sunsign,
    lunarMonthIndex,
    ruthuvuIndex,
    abhijit,
    brahmaMuhurtam,
    amrutaGhadiyalu,
    varjam,
    durmuhurtham,
  };
}
