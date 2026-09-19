import { FastifyInstance } from 'fastify';
import { computeFestivals, type Festival } from '../lib/panchang/festivals.js';
import { isValidTimezone } from '../lib/validation.js';

interface FestivalsQuery {
  year?: string;
  lat: string;
  lon: string;
  tz: string;
  ayanamsa?: string;
}

// A year scan costs about a second of synchronous CPU, so repeat requests for
// the same year/location/ayanāṃśa are served from a small in-memory cache.
const CACHE_MAX = 64;
const cache = new Map<string, Festival[]>();

export async function festivalRoutes(app: FastifyInstance) {
  app.get<{ Querystring: FestivalsQuery }>('/api/v1/festivals', async (request, reply) => {
    const { year, lat, lon, tz, ayanamsa = 'lahiri' } = request.query;
    const yearNum = Number(year);
    if (!year || !Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return reply.status(400).send({ code: 'INVALID_YEAR', message: 'year must be an integer 1900–2100' });
    }
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return reply.status(400).send({ code: 'INVALID_LAT', message: 'lat must be between -90 and 90' });
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      return reply.status(400).send({ code: 'INVALID_LON', message: 'lon must be between -180 and 180' });
    }
    if (!isValidTimezone(tz)) {
      return reply
        .status(400)
        .send({ code: 'INVALID_TZ', message: 'tz must be a valid IANA timezone (e.g. Asia/Kolkata)' });
    }

    // Sunrise shifts ~4 min per degree of longitude, so 2 decimals (~1 km) is ample for the cache key.
    const key = [yearNum, latNum.toFixed(2), lonNum.toFixed(2), tz, ayanamsa].join('|');
    let festivals = cache.get(key);
    if (!festivals) {
      festivals = computeFestivals(yearNum, latNum, lonNum, tz, ayanamsa);
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, festivals);
    }
    return reply.send({
      request: { year: yearNum, lat: latNum, lon: lonNum, tz, ayanamsa, ruleset: 'telugu_amanta' },
      festivals,
    });
  });
}
