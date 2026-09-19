import { dateToJulianDay, calculatePosition, Planet } from '@swisseph/node';
import { SIDEREAL_FLAGS } from './constants.js';
import { TITHI_DEG } from './constants.js';
import { findTransition, getSunriseSunset, jdToDate, normalizeLon, weekdayInTz } from './astronomy.js';
import { setSiderealModeFromQuery } from './ayanamsa.js';

export type FestivalCategory = 'popular' | 'traditional';

/** Which moment of the civil day the tithi is judged at (Hindu festivals are kāla-vyāpinī). */
type Kaala = 'sunrise' | 'madhyahna' | 'aparahna' | 'pradosha' | 'nishitha';

interface TithiRule {
  id: string;
  category: FestivalCategory;
  en: string;
  te: string;
  /** Amānta lunar month index, 0 = Chaitra … 11 = Phālguna. */
  month: number;
  /** Tithi index 0–29: 0 = Śukla pratipada, 14 = Pūrṇima, 15 = Kṛṣṇa pratipada, 29 = Amāvasya. */
  tithi: number;
  kaala: Kaala;
}

export interface Festival {
  id: string;
  date: string;
  category: FestivalCategory;
  name: { en: string; te: string };
}

// Tithi-based festivals of the Telugu (Amānta) calendar. Months are named as
// the engine names them (see lunarMonth.ts); Adhika lunations are skipped so a
// festival lands in the nija month.
const TITHI_RULES: readonly TithiRule[] = [
  {
    id: 'ugadi',
    category: 'popular',
    en: 'Ugadi (Telugu New Year)',
    te: 'ఉగాది',
    month: 0,
    tithi: 0,
    kaala: 'madhyahna',
  },
  {
    id: 'sri-rama-navami',
    category: 'popular',
    en: 'Sri Rama Navami',
    te: 'శ్రీరామ నవమి',
    month: 0,
    tithi: 8,
    kaala: 'madhyahna',
  },
  {
    id: 'akshaya-tritiya',
    category: 'traditional',
    en: 'Akshaya Tritiya',
    te: 'అక్షయ తృతీయ',
    month: 1,
    tithi: 2,
    kaala: 'sunrise',
  },
  {
    id: 'narasimha-jayanti',
    category: 'traditional',
    en: 'Narasimha Jayanti',
    te: 'నృసింహ జయంతి',
    month: 1,
    tithi: 13,
    kaala: 'pradosha',
  },
  {
    id: 'tholi-ekadashi',
    category: 'traditional',
    en: 'Tholi Ekadashi',
    te: 'తొలి ఏకాదశి',
    month: 3,
    tithi: 10,
    kaala: 'sunrise',
  },
  {
    id: 'guru-purnima',
    category: 'traditional',
    en: 'Guru Purnima',
    te: 'గురు పూర్ణిమ',
    month: 3,
    tithi: 14,
    kaala: 'sunrise',
  },
  {
    id: 'naga-panchami',
    category: 'traditional',
    en: 'Naga Panchami',
    te: 'నాగ పంచమి',
    month: 4,
    tithi: 4,
    kaala: 'madhyahna',
  },
  {
    id: 'raksha-bandhan',
    category: 'popular',
    en: 'Raksha Bandhan (Shravana Purnima)',
    te: 'రాఖీ పౌర్ణమి',
    month: 4,
    tithi: 14,
    kaala: 'sunrise',
  },
  {
    id: 'krishna-janmashtami',
    category: 'popular',
    en: 'Krishna Janmashtami',
    te: 'శ్రీకృష్ణ జన్మాష్టమి',
    month: 4,
    tithi: 22,
    kaala: 'nishitha',
  },
  {
    id: 'vinayaka-chavithi',
    category: 'popular',
    en: 'Ganesh Chaturthi (Vinayaka Chavithi)',
    te: 'వినాయక చవితి',
    month: 5,
    tithi: 3,
    kaala: 'madhyahna',
  },
  {
    id: 'ananta-chaturdashi',
    category: 'traditional',
    en: 'Ananta Chaturdashi (Ganesh Nimajjanam)',
    te: 'అనంత చతుర్దశి',
    month: 5,
    tithi: 13,
    kaala: 'sunrise',
  },
  {
    id: 'mahalaya-amavasya',
    category: 'traditional',
    en: 'Mahalaya Amavasya (Engili Puvvu Bathukamma)',
    te: 'మహాలయ అమావాస్య',
    month: 5,
    tithi: 29,
    kaala: 'madhyahna',
  },
  {
    id: 'navaratri-begins',
    category: 'popular',
    en: 'Dasara Navaratri begins',
    te: 'దసరా నవరాత్రులు ప్రారంభం',
    month: 6,
    tithi: 0,
    kaala: 'sunrise',
  },
  {
    id: 'saddula-bathukamma',
    category: 'traditional',
    en: 'Saddula Bathukamma / Durgashtami',
    te: 'సద్దుల బతుకమ్మ / దుర్గాష్టమి',
    month: 6,
    tithi: 7,
    kaala: 'madhyahna',
  },
  {
    id: 'vijayadashami',
    category: 'popular',
    en: 'Vijayadashami (Dasara)',
    te: 'విజయదశమి (దసరా)',
    month: 6,
    tithi: 9,
    kaala: 'aparahna',
  },
  {
    id: 'atla-taddi',
    category: 'traditional',
    en: 'Atla Taddi',
    te: 'అట్ల తద్ది',
    month: 6,
    tithi: 17,
    kaala: 'pradosha',
  },
  {
    id: 'dhanteras',
    category: 'traditional',
    en: 'Dhanteras (Dhanatrayodashi)',
    te: 'ధన త్రయోదశి',
    month: 6,
    tithi: 27,
    kaala: 'pradosha',
  },
  {
    id: 'naraka-chaturdashi',
    category: 'traditional',
    en: 'Naraka Chaturdashi',
    te: 'నరక చతుర్దశి',
    month: 6,
    tithi: 28,
    kaala: 'sunrise',
  },
  {
    id: 'diwali',
    category: 'popular',
    en: 'Deepavali (Diwali)',
    te: 'దీపావళి',
    month: 6,
    tithi: 29,
    kaala: 'pradosha',
  },
  {
    id: 'bhagini-hastha-bhojanam',
    category: 'traditional',
    en: 'Bhagini Hastha Bhojanam (Bhai Dooj)',
    te: 'భగినీ హస్త భోజనం',
    month: 7,
    tithi: 1,
    kaala: 'madhyahna',
  },
  {
    id: 'nagula-chavithi',
    category: 'traditional',
    en: 'Nagula Chavithi',
    te: 'నాగుల చవితి',
    month: 7,
    tithi: 3,
    kaala: 'madhyahna',
  },
  {
    id: 'karthika-purnima',
    category: 'traditional',
    en: 'Karthika Purnima',
    te: 'కార్తీక పౌర్ణమి',
    month: 7,
    tithi: 14,
    kaala: 'pradosha',
  },
  {
    id: 'mukkoti-ekadashi',
    category: 'popular',
    en: 'Vaikuntha (Mukkoti) Ekadashi',
    te: 'వైకుంఠ (ముక్కోటి) ఏకాదశి',
    month: 9,
    tithi: 10,
    kaala: 'sunrise',
  },
  {
    id: 'vasanta-panchami',
    category: 'traditional',
    en: 'Vasanta Panchami (Sri Panchami)',
    te: 'వసంత పంచమి (శ్రీ పంచమి)',
    month: 10,
    tithi: 4,
    kaala: 'madhyahna',
  },
  {
    id: 'ratha-saptami',
    category: 'traditional',
    en: 'Ratha Saptami',
    te: 'రథ సప్తమి',
    month: 10,
    tithi: 6,
    kaala: 'sunrise',
  },
  {
    id: 'maha-shivaratri',
    category: 'popular',
    en: 'Maha Shivaratri',
    te: 'మహా శివరాత్రి',
    month: 10,
    tithi: 28,
    kaala: 'nishitha',
  },
  {
    id: 'holi',
    category: 'popular',
    en: 'Holi (Kamadahanam)',
    te: 'హోలీ (కామదహనం)',
    month: 11,
    tithi: 14,
    kaala: 'pradosha',
  },
];

// Weekdays that are observed as vratam days throughout a lunar month
// (vara: 0 = Sunday). Each occurrence is numbered within the month.
const WEEKDAY_RULES: readonly {
  id: string;
  month: number;
  vara: number;
  en: string;
  te: string;
}[] = [
  { id: 'shravana-mangalavaram', month: 4, vara: 2, en: 'Shravana Mangalavaram', te: 'శ్రావణ మంగళవారం' },
  { id: 'shravana-sukravaram', month: 4, vara: 5, en: 'Shravana Sukravaram', te: 'శ్రావణ శుక్రవారం' },
  { id: 'shravana-shanivaram', month: 4, vara: 6, en: 'Shravana Shanivaram', te: 'శ్రావణ శనివారం' },
  { id: 'karthika-somavaram', month: 7, vara: 1, en: 'Karthika Somavaram', te: 'కార్తీక సోమవారం' },
  { id: 'margashira-guruvaram', month: 8, vara: 4, en: 'Margashira Guruvaram', te: 'మార్గశిర గురువారం' },
];

interface DayInfo {
  date: string;
  sunrise: number;
  sunset: number;
  vara: number;
  sunsign: number;
  tithi: number;
  tithiEnd: number | null;
  /** Index of the lunation (amāvasya-to-amāvasya) this day's sunrise falls in. */
  lunation: number;
}

const DAY_MS = 24 * 3600 * 1000;

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function kaalaMs(day: DayInfo, kaala: Kaala): number {
  const dayLen = day.sunset - day.sunrise;
  switch (kaala) {
    case 'sunrise':
      return day.sunrise + 60_000;
    case 'madhyahna':
      return day.sunrise + dayLen / 2;
    case 'aparahna':
      return day.sunrise + dayLen * 0.7;
    case 'pradosha':
      return day.sunset + 48 * 60_000;
    case 'nishitha':
      return day.sunset + (DAY_MS - dayLen) / 2;
  }
}

/** Tithi in force at `ms` on this panchang day (at most one tithi change falls in a sunrise-to-sunrise window). */
function tithiAt(day: DayInfo, ms: number): number {
  return day.tithiEnd !== null && ms >= day.tithiEnd ? (day.tithi + 1) % 30 : day.tithi;
}

/**
 * All festivals of `year` for the Telugu (Amānta) ruleset at the given location
 * and ayanāṃśa. Tithi-based dates shift with the ayanāṃśa and the observer's
 * sunrise/sunset, so this runs the engine day by day rather than using a table.
 */
export function computeFestivals(
  year: number,
  lat: number,
  lon: number,
  tz: string,
  ayanamsa: string
): Festival[] {
  // Pad both ends: the first lunation of the year may have started in the
  // previous year, and Adhika detection needs to see the lunation after it.
  const scanStart = `${year - 1}-12-01`;
  const scanEnd = `${year + 1}-01-31`;

  // setSiderealMode is process-global; everything below is synchronous (see computePanchang).
  setSiderealModeFromQuery(ayanamsa);
  const getSunMoon = (jd: number) => ({
    sun: calculatePosition(jd, Planet.Sun, SIDEREAL_FLAGS).longitude,
    moon: calculatePosition(jd, Planet.Moon, SIDEREAL_FLAGS).longitude,
  });
  const tithiValue = (jd: number) => {
    const sm = getSunMoon(jd);
    return normalizeLon(sm.moon - sm.sun);
  };

  const ymds: string[] = [];
  for (let ymd = scanStart; ymd <= scanEnd; ymd = addDays(ymd, 1)) ymds.push(ymd);
  const rises = ymds.map((ymd) => getSunriseSunset(ymd, lat, lon, tz));

  // Only sunrise tithi/sunsign per day are needed; the (expensive) lunar month
  // is resolved once per lunation below instead of once per day.
  const days: DayInfo[] = [];
  const amavasyaSign = new Map<number, number>();
  let lunation = 0;
  for (let i = 0; i < ymds.length - 1; i++) {
    const jdStart = dateToJulianDay(rises[i].sunrise);
    const jdEnd = dateToJulianDay(rises[i + 1].sunrise);
    const tithi = Math.floor(tithiValue(jdStart) / TITHI_DEG) % 30;
    const sunsign = Math.floor(normalizeLon(getSunMoon(jdStart).sun) / 30) % 12;
    const endJd = findTransition(jdStart, jdEnd, tithiValue, tithi, TITHI_DEG, 30);
    const prev = days[days.length - 1];
    // A drop from late kṛṣṇa pakṣa back to early śukla pakṣa is a new lunation.
    const startsLunation = !prev || (prev.tithi >= 20 && tithi <= 10);
    if (prev && startsLunation) lunation++;
    if (startsLunation) {
      // Named for the Sun's rāśi at the amāvasya that opens the lunation. That
      // is the previous day's amāvasya→pratipada tithi boundary when there is
      // one; otherwise the first sunrise stands in.
      const amavasyaJd =
        prev && prev.tithi === 29 && prev.tithiEnd !== null
          ? dateToJulianDay(new Date(prev.tithiEnd))
          : jdStart;
      amavasyaSign.set(lunation, Math.floor(normalizeLon(getSunMoon(amavasyaJd).sun) / 30) % 12);
    }
    days.push({
      date: ymds[i],
      sunrise: rises[i].sunrise.getTime(),
      sunset: rises[i].sunset.getTime(),
      vara: weekdayInTz(rises[i].sunrise, tz),
      sunsign,
      tithi,
      tithiEnd: endJd === null ? null : jdToDate(endJd).getTime(),
      lunation,
    });
  }

  const monthOfLunation = new Map<number, number>();
  for (const [l, sign] of amavasyaSign) monthOfLunation.set(l, (sign + 1) % 12);
  // Month per lunation; a lunation named the same as its successor has no
  // saṅkrānti inside it, which is exactly what makes it Adhika.
  const isAdhika = (l: number) =>
    monthOfLunation.has(l + 1) && monthOfLunation.get(l) === monthOfLunation.get(l + 1);

  // Lunation and tithi at a rule's kāla. Around amāvasya the kāla can already
  // sit in the next lunation even though the day's sunrise does not.
  const at = (i: number, kaala: Kaala) => {
    const d = days[i];
    const t = tithiAt(d, kaalaMs(d, kaala));
    return { tithi: t, lunation: d.lunation + (d.tithi >= 20 && t <= 10 ? 1 : 0) };
  };

  const found: Festival[] = [];
  const push = (id: string, date: string, category: FestivalCategory, en: string, te: string) => {
    if (date.startsWith(`${year}-`)) found.push({ id, date, category, name: { en, te } });
  };

  for (const rule of TITHI_RULES) {
    const perLunation = new Map<number, number>();
    for (let i = 0; i < days.length; i++) {
      const k = at(i, rule.kaala);
      if (monthOfLunation.get(k.lunation) !== rule.month || isAdhika(k.lunation)) continue;
      if (k.tithi === rule.tithi && !perLunation.has(k.lunation)) perLunation.set(k.lunation, i);
    }
    // Kṣaya tithi: it begins and ends between two consecutive kālas, so no
    // day "has" it — observe it on the day it begins.
    for (let i = 0; i < days.length - 1; i++) {
      const a = at(i, rule.kaala);
      const b = at(i + 1, rule.kaala);
      if (monthOfLunation.get(a.lunation) !== rule.month || isAdhika(a.lunation)) continue;
      if (perLunation.has(a.lunation)) continue;
      if (a.tithi === (rule.tithi + 29) % 30 && b.tithi === (rule.tithi + 1) % 30) {
        perLunation.set(a.lunation, i);
      }
    }
    for (const i of perLunation.values()) push(rule.id, days[i].date, rule.category, rule.en, rule.te);
  }

  // Varalakshmi Vratam: the Friday before Shravana Pūrṇima (last Friday of śukla pakṣa before it).
  for (const [l, month] of monthOfLunation) {
    if (month !== 4 || isAdhika(l)) continue;
    const fridays = days.filter((d) => d.lunation === l && d.vara === 5 && d.tithi <= 13);
    const last = fridays[fridays.length - 1];
    if (last) push('varalakshmi-vratam', last.date, 'traditional', 'Varalakshmi Vratam', 'వరలక్ష్మీ వ్రతం');
  }

  // Makara Saṅkrānti: Sun's sidereal ingress into Makara (sign 9); observed on
  // that day if it happens before sunset, else the next. Bhogi/Kanuma flank it.
  const sunLon = (jd: number) => calculatePosition(jd, Planet.Sun, SIDEREAL_FLAGS).longitude;
  for (let i = 0; i < days.length - 1; i++) {
    if (days[i].sunsign !== 8 || days[i + 1].sunsign !== 9) continue;
    const ingressJd = findTransition(
      dateToJulianDay(new Date(days[i].sunrise)),
      dateToJulianDay(new Date(days[i + 1].sunrise)),
      sunLon,
      8,
      30,
      12
    );
    const ingressMs = ingressJd === null ? days[i].sunset : jdToDate(ingressJd).getTime();
    const sankranti = ingressMs <= days[i].sunset ? i : i + 1;
    push('bhogi', days[sankranti - 1].date, 'popular', 'Bhogi', 'భోగి');
    push('makara-sankranti', days[sankranti].date, 'popular', 'Makara Sankranti', 'మకర సంక్రాంతి');
    push('kanuma', days[sankranti + 1].date, 'popular', 'Kanuma', 'కనుమ');
  }

  for (const rule of WEEKDAY_RULES) {
    const perLunation = new Map<number, number>();
    for (const d of days) {
      if (d.vara !== rule.vara || monthOfLunation.get(d.lunation) !== rule.month || isAdhika(d.lunation))
        continue;
      const n = (perLunation.get(d.lunation) ?? 0) + 1;
      perLunation.set(d.lunation, n);
      push(rule.id, d.date, 'traditional', `${rule.en} (${n})`, `${rule.te} (${n})`);
    }
  }

  return found.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
