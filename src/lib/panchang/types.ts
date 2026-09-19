export interface SunriseSunset {
  sunrise: Date;
  sunset: Date;
}

export interface MoonriseMoonset {
  moonrise: Date | null;
  moonset: Date | null;
}

export interface PanchangElement {
  index: number;
  nameKey: string;
  startTime: Date;
  endTime: Date | null;
}

export interface Kaalam {
  name: string;
  start: Date;
  end: Date;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PanchangResult {
  date: string;
  sunrise: Date;
  sunset: Date;
  tithi: PanchangElement;
  nakshatra: PanchangElement;
  yoga: PanchangElement;
  karanas: PanchangElement[];
  kaalams: Kaalam[];
  vara: number;
  paksham: number;
  moonsign: number;
  sunsign: number;
  lunarMonthIndex: number;
  ruthuvuIndex: number;
  moonrise: Date | null;
  moonset: Date | null;
  abhijit: TimeRange;
  brahmaMuhurtam: TimeRange;
  amrutaGhadiyalu: TimeRange[];
  varjam: TimeRange | null;
  durmuhurtham: TimeRange[];
}

/** Sidereal Sun/Moon longitude pair at a given Julian day. */
export type SunMoonLon = { sun: number; moon: number };
