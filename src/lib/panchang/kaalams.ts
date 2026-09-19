import type { Kaalam, TimeRange } from './types.js';

const DUR_MUHURTAM_48_MS = 48 * 60 * 1000;

function durMuhurtamOffsetMs(hours: number, minutes: number): number {
  return (hours * 60 + minutes) * 60 * 1000;
}

/**
 * Durmuhūrtam — fully hardcoded per weekday, as fixed offsets from
 * sunrise/sunset. This is the Phase-1 Telugu ruleset's chosen convention;
 * see docs/PANCHANG_LOGIC.md §6.2 for why Saturday in particular is a single
 * 48-minute window (not the 96-minute window some other sources use) and
 * for the source cross-checked against.
 */
export function durmuhurtamRanges(sunrise: Date, sunset: Date, weekday: number): TimeRange[] {
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  const span = (startMs: number, durationMs: number): TimeRange => ({
    start: new Date(startMs),
    end: new Date(startMs + durationMs),
  });
  const o = durMuhurtamOffsetMs;

  switch (weekday) {
    case 0:
      return [span(sr + o(10, 24), DUR_MUHURTAM_48_MS)];
    case 1:
      return [span(sr + o(6, 24), DUR_MUHURTAM_48_MS), span(sr + o(8, 48), DUR_MUHURTAM_48_MS)];
    case 2:
      return [span(sr + o(2, 24), DUR_MUHURTAM_48_MS), span(ss + o(5, 36), DUR_MUHURTAM_48_MS)];
    case 3:
      return [span(sr + o(5, 36), DUR_MUHURTAM_48_MS)];
    case 4:
      return [span(sr + o(4, 0), DUR_MUHURTAM_48_MS), span(sr + o(8, 48), DUR_MUHURTAM_48_MS)];
    case 5:
      return [span(sr + o(2, 24), DUR_MUHURTAM_48_MS), span(sr + o(8, 48), DUR_MUHURTAM_48_MS)];
    case 6:
      return [span(sr, DUR_MUHURTAM_48_MS)];
    default:
      return [span(sr + o(10, 24), DUR_MUHURTAM_48_MS)];
  }
}

// Part index (1-based, of 8 equal sunrise→sunset parts), by weekday (0 = Sunday … 6 = Saturday).
const RAHU_KAALAM_PART_BY_WEEKDAY = [8, 2, 7, 5, 6, 4, 3];
const YAMAGANDAM_PART_BY_WEEKDAY = [5, 4, 3, 2, 1, 7, 6];
const GULIKA_KAALAM_PART_BY_WEEKDAY = [7, 6, 5, 4, 3, 2, 1];

/** Rāhu / Yamagaṇḍa / Gulika kālam — each a fixed 1/8th slice of sunrise→sunset, keyed by weekday. */
export function computeKaalams(weekday: number, sunrise: Date, partDuration: number): Kaalam[] {
  const parts: Array<{ name: string; part: number }> = [
    { name: 'rahu', part: RAHU_KAALAM_PART_BY_WEEKDAY[weekday] },
    { name: 'yamagandam', part: YAMAGANDAM_PART_BY_WEEKDAY[weekday] },
    { name: 'gulika', part: GULIKA_KAALAM_PART_BY_WEEKDAY[weekday] },
  ];
  return parts.map(({ name, part }) => {
    const startOffset = (part - 1) * partDuration;
    const start = new Date(sunrise.getTime() + startOffset * 3600 * 1000);
    const end = new Date(start.getTime() + partDuration * 3600 * 1000);
    return { name, start, end };
  });
}
