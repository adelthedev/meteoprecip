# AgViewer — Panorama hidrometeorológico de Chile

A single static HTML page (`index.html`) with no build step: a Spanish-language
dashboard tracking precipitation accumulation, normals and a 5-day forecast for ~60
Chilean localities, plus a heatmap/marker map, during a reported July storm event.

## Structure

- **One page, one file.** `index.html` contains everything: markup, a large inline
  `<style>` block, and a single inline `<script>` block (around line 721 to the end)
  with all page logic. There is no router — `detected routes: ["/"]` — and no other
  HTML, JS or CSS files in the repo.
- **Data model.** All locality data (id, name, region, zone, lat/lon, historical
  average `avg`, `fallbackAccum`, `fallbackForecast`, `alert` level, optional `note`)
  lives in a hardcoded `const DATA = [...]` array inside the inline script. This is
  the page's own "backend" — it is not fetched from anywhere.
- **Sections or views**, all built from `DATA` at load:
  - A list view: a scrollable spine of dots (`.spine-dot`) alongside a grid of
    `.card` elements, one per locality, each showing accumulated precipitation,
    percent vs. the DGA historical average, and a 5-day forecast with daily chips.
  - A map view (`#leafletMap`, toggled with `.viewtab` buttons) built with Leaflet,
    showing colored circle markers plus an optional heatmap layer (toggled between
    "forecast" and "accum" modes via `#heatToggle`).
  - A "top rain" ranking panel (`#topRainList`) of the top-8 localities by forecast
    total, computed client-side once live data has loaded.
  - Search (`#search`), status chips (`.chip`, filter by alarm/deficit/surplus) and
    zone chips (`.zone-chip`, filter by costa/valle/cordillera) filter the card grid
    client-side; nothing is re-fetched.
- **Naming conventions:** BEM-ish flat class names (`.card`, `.card-top`,
  `.spine-dot`, `.zone-chip`, `.top-rain-item`, etc.), `data-*` attributes
  (`data-name`, `data-region`, `data-alert`, `data-status`, `data-zone`) used for
  client-side filtering rather than for any data fetching. Element ids are
  interpolated per-locality (`accum-${id}`, `pct-${id}`, `card-${id}`, `dot-${id}`).

## CDN dependencies

Loaded via `<link>`/`<script>` tags, not bundled:
- Google Fonts (`Open Sans`).
- Leaflet 1.9.4 (JS + CSS) from cdnjs, for the map view.
- `leaflet.heat` 0.2.0 from jsDelivr, for the heatmap layer.
- Leaflet's own basemap tiles from `{s}.tile.openstreetmap.org` (image tiles, not
  JSON — left alone, not mocked).

## Network calls

The page makes exactly two kinds of live network calls, both to the third-party
**Open-Meteo** weather APIs, once per locality in `DATA`, fired in parallel from
`loadAllLiveData()` / `fetchCityLive()`:

1. `GET https://archive-api.open-meteo.com/v1/archive?latitude=…&longitude=…&start_date=…&end_date=…&daily=precipitation_sum&timezone=auto`
   — year-to-date historical precipitation, read as `archive.daily.precipitation_sum`.
2. `GET https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&past_days=6&forecast_days=5&daily=precipitation_sum&timezone=auto`
   — recent-past + 5-day forecast, read as `forecast.daily.time` and
   `forecast.daily.precipitation_sum`.

If either call fails, the page falls back to the static `fallbackAccum` /
`fallbackForecast` figures baked into `DATA` and shows a "no se pudo conectar" note —
this fallback path is reachable but not the one exercised by the mocks.

There is no call to any backend of this site's own; all non-weather data is static
and embedded in the HTML.

## Mock layer (`mocks/handlers.js`)

Both Open-Meteo endpoints are mocked. Since there is no OpenAPI spec or sample JSON
committed in this repo, the response shape was inferred entirely from how
`fetchCityLive()` reads it (tier 3 — `daily.time` / `daily.precipitation_sum` arrays
aligned to the requested date range). Values are deterministic pseudo-random
precipitation figures seeded from `latitude,longitude,date`, scaled up for more
southerly/cordillera coordinates so the map doesn't look flat — not real climate
data. Handlers parse `start_date`/`end_date` (archive) or `past_days`/`forecast_days`
relative to the current date (forecast) to always return a `daily.time` array that
matches what the page's code expects to iterate over.

No handler was needed for the site's own backend — there isn't one.
