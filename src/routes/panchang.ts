import { FastifyInstance } from 'fastify';
import { computePanchang } from '../lib/panchang/index.js';
import { isValidTimezone } from '../lib/validation.js';

interface PanchangQuery {
  date?: string;
  lat: string;
  lon: string;
  tz: string;
  ayanamsa?: string;
}

function asIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function addCalendarDaysIso(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function normalizeCorePayload(result: ReturnType<typeof computePanchang>) {
  return {
    date: result.date,
    sunrise: result.sunrise.toISOString(),
    sunset: result.sunset.toISOString(),
    moonrise: asIso(result.moonrise),
    moonset: asIso(result.moonset),
    vara: result.vara,
    paksham: result.paksham,
    moonsign: result.moonsign,
    sunsign: result.sunsign,
    lunarMonthIndex: result.lunarMonthIndex,
    ruthuvuIndex: result.ruthuvuIndex,
    tithi: {
      ...result.tithi,
      startTime: result.tithi.startTime.toISOString(),
      endTime: asIso(result.tithi.endTime),
    },
    nakshatra: {
      ...result.nakshatra,
      startTime: result.nakshatra.startTime.toISOString(),
      endTime: asIso(result.nakshatra.endTime),
    },
    yoga: {
      ...result.yoga,
      startTime: result.yoga.startTime.toISOString(),
      endTime: asIso(result.yoga.endTime),
    },
    karanas: result.karanas.map((k) => ({
      ...k,
      startTime: k.startTime.toISOString(),
      endTime: asIso(k.endTime),
    })),
    karthi: {
      ...result.karthi,
      startTime: result.karthi.startTime.toISOString(),
      endTime: asIso(result.karthi.endTime),
    },
    kaalams: result.kaalams.map((k) => ({
      ...k,
      start: k.start.toISOString(),
      end: k.end.toISOString(),
    })),
    abhijit: {
      start: result.abhijit.start.toISOString(),
      end: result.abhijit.end.toISOString(),
    },
    brahmaMuhurtam: {
      start: result.brahmaMuhurtam.start.toISOString(),
      end: result.brahmaMuhurtam.end.toISOString(),
    },
    amrutaGhadiyalu: result.amrutaGhadiyalu.map((r) => ({
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    })),
    varjam: result.varjam.map((r) => ({
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    })),
    durmuhurtham: result.durmuhurtham.map((r) => ({
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    })),
  };
}

function buildCoreForDate(dateStr: string, lat: string, lon: string, tz: string, ayanamsa: string) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return { error: { code: 'INVALID_LAT', message: 'lat must be between -90 and 90' } };
  }
  if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return { error: { code: 'INVALID_LON', message: 'lon must be between -180 and 180' } };
  }
  if (!isValidTimezone(tz)) {
    return { error: { code: 'INVALID_TZ', message: 'tz must be a valid IANA timezone (e.g. Asia/Kolkata)' } };
  }

  const result = computePanchang(dateStr, latNum, lonNum, tz, ayanamsa);
  return {
    data: {
      request: { date: dateStr, lat: latNum, lon: lonNum, tz, ayanamsa },
      meta: { engine: 'auspico', version: '1.0.0', contract: 'v1' },
      core: normalizeCorePayload(result),
    },
  };
}

export async function panchangRoutes(app: FastifyInstance) {
  app.get<{ Querystring: PanchangQuery }>('/api/v1/panchang/today', async (request, reply) => {
    const { lat, lon, tz, ayanamsa = 'lahiri' } = request.query;
    const today = new Date().toISOString().slice(0, 10);
    const response = buildCoreForDate(today, lat, lon, tz, ayanamsa);
    if ('error' in response) return reply.status(400).send(response.error);
    return reply.send(response.data);
  });

  app.get<{ Querystring: PanchangQuery }>('/api/v1/panchang/date', async (request, reply) => {
    const { date, lat, lon, tz, ayanamsa = 'lahiri' } = request.query;
    if (!date)
      return reply.status(400).send({ code: 'MISSING_DATE', message: 'date is required (YYYY-MM-DD)' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ code: 'INVALID_DATE', message: 'date must be YYYY-MM-DD' });
    }
    const response = buildCoreForDate(date, lat, lon, tz, ayanamsa);
    if ('error' in response) return reply.status(400).send(response.error);
    return reply.send(response.data);
  });

  app.get<{ Querystring: PanchangQuery & { start?: string; end?: string } }>(
    '/api/v1/panchang/range',
    async (request, reply) => {
      const { start, end, lat, lon, tz, ayanamsa = 'lahiri' } = request.query;
      if (!start || !end) {
        return reply
          .status(400)
          .send({ code: 'MISSING_RANGE', message: 'start and end are required (YYYY-MM-DD)' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return reply.status(400).send({ code: 'INVALID_RANGE', message: 'start and end must be YYYY-MM-DD' });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000)) + 1;
      if (days > 31) {
        return reply.status(400).send({ code: 'RANGE_TOO_LARGE', message: 'Maximum 31 days' });
      }

      const results = [];
      for (let i = 0; i < days; i++) {
        const dateStr = addCalendarDaysIso(start, i);
        const response = buildCoreForDate(dateStr, lat, lon, tz, ayanamsa);
        if ('error' in response) return reply.status(400).send(response.error);
        results.push(response.data);
      }
      return reply.send({ days: results });
    }
  );
}
