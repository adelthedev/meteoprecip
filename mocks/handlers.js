// Mock layer for AgViewer — Panorama hidrometeorológico de Chile.
//
// The page's only network calls are to the third-party Open-Meteo APIs
// (archive-api.open-meteo.com and api.open-meteo.com), requested per locality
// using each locality's latitude/longitude (see the DATA array in index.html).
// There is no call to a backend of this site's own: all locality metadata
// (name, region, averages, fallback figures) is embedded directly in the page.
//
// Response shape (daily.time / daily.precipitation_sum arrays) is inferred
// from how index.html's fetchCityLive() reads the response — this is a guess
// at the real Open-Meteo schema, not read from any spec in this repo.

const { http, HttpResponse } = window.MockServiceWorker;

// Deterministic pseudo-random in [0, 1) from a string seed, so the same
// request always yields the same mocked precipitation values.
function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function dateRange(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  const days = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(toDateStr(d));
  }
  return days;
}

// Rougher daily rainfall amplitude for far-southern/cordillera latitudes
// (humid) vs. the northern desert (arid), just to keep the mocked map from
// looking uniform. Not derived from any real climate data.
function amplitudeFor(lat) {
  return Math.max(0, -18 - lat) * 0.25;
}

function buildPrecipSeries(lat, lon, days, salt) {
  const ampl = amplitudeFor(lat);
  return days.map((day) => {
    const r = seededRandom(`${lat},${lon},${day},${salt}`);
    return Math.round(r * ampl * 2 * 10) / 10;
  });
}

export const handlers = [
  // Historical year-to-date precipitation for a locality.
  http.get('https://archive-api.open-meteo.com/v1/archive', ({ request }) => {
    const url = new URL(request.url);
    const latitude = parseFloat(url.searchParams.get('latitude'));
    const longitude = parseFloat(url.searchParams.get('longitude'));
    const start = url.searchParams.get('start_date');
    const end = url.searchParams.get('end_date');
    const days = dateRange(start, end);
    const precipitation_sum = buildPrecipSeries(latitude, longitude, days, 'archive');

    return HttpResponse.json({
      latitude,
      longitude,
      daily_units: { time: 'iso8601', precipitation_sum: 'mm' },
      daily: { time: days, precipitation_sum },
    });
  }),

  // Recent-past + 5-day forecast precipitation for a locality.
  http.get('https://api.open-meteo.com/v1/forecast', ({ request }) => {
    const url = new URL(request.url);
    const latitude = parseFloat(url.searchParams.get('latitude'));
    const longitude = parseFloat(url.searchParams.get('longitude'));
    const pastDays = parseInt(url.searchParams.get('past_days') || '0', 10);
    const forecastDays = parseInt(url.searchParams.get('forecast_days') || '7', 10);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - pastDays);
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + forecastDays - 1);

    const days = dateRange(toDateStr(start), toDateStr(end));
    const precipitation_sum = buildPrecipSeries(latitude, longitude, days, 'forecast');

    return HttpResponse.json({
      latitude,
      longitude,
      daily_units: { time: 'iso8601', precipitation_sum: 'mm' },
      daily: { time: days, precipitation_sum },
    });
  }),
];
