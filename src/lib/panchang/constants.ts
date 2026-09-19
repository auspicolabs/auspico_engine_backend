import { CalculationFlag } from '@swisseph/node';

export const SIDEREAL_FLAGS =
  CalculationFlag.SwissEphemeris | CalculationFlag.Speed | CalculationFlag.Sidereal;
export const TROPICAL_FLAGS = CalculationFlag.SwissEphemeris | CalculationFlag.Speed;

export const NAKSHATRA_DEG = 360 / 27;
export const YOGA_DEG = 360 / 27;
export const TITHI_DEG = 360 / 30;
export const GHATIKA_MINUTES = 24;
export const VARJAM_DURATION_MINUTES = 96;
export const AMRITA_DURATION_FACTOR = 1.6 / 24;

export const NAKSHATRA_THYAJYA_GHATIKA_OFFSETS: number[] = [
  50, 4, 30, 40, 14, 21, 30, 20, 32, 30, 20, 1, 21, 20, 14, 14, 10, 14, 20, 20, 20, 10, 10, 18, 16, 30, 30,
];

export const NAKSHATRA_AMRITA_START_HOURS: number[] = [
  16.8, 19.2, 21.6, 20.8, 15.2, 14.4, 21.6, 17.6, 22.4, 21.6, 17.6, 16.8, 18.4, 17.6, 15.2, 15.2, 13.6, 15.2,
  17.6, 19.2, 17.6, 13.6, 13.6, 16.8, 16.0, 19.2, 21.6,
];
