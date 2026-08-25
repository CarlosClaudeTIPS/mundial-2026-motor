// ─── Clima del partido — Open-Meteo (gratis, sin API key) ────────────────────
// Geocodifica la ciudad del estadio y trae el pronóstico de la hora del partido.
// Auto-sugiere los checks de contexto 'calor' y 'lluvia' del motor.

const CACHE_KEY = 'motor_clima_cache_v1'
const TTL_GEO = 90 * 24 * 3600_000  // coordenadas de una ciudad no cambian
const TTL_FC  = 3 * 3600_000        // pronóstico: 3h

function getCache(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const e = raw[key]
    if (!e || Date.now() - e.ts > e.ttl) return null
    return e.data
  } catch { return null }
}

function setCache(key, data, ttl) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    raw[key] = { data, ts: Date.now(), ttl }
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw))
  } catch {}
}

async function geocode(city) {
  const key = `geo_${city.toLowerCase()}`
  const cached = getCache(key)
  if (cached) return cached
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`,
    { signal: AbortSignal.timeout(8000) }
  )
  const data = await res.json()
  const hit = data?.results?.[0]
  if (!hit) return null
  const out = { lat: hit.latitude, lon: hit.longitude, name: hit.name, country: hit.country_code }
  setCache(key, out, TTL_GEO)
  return out
}

// city: ciudad del estadio (fixture.venue) · isoDate: fecha-hora del partido
export async function fetchClima(city, isoDate) {
  if (!city || !isoDate) return null
  const clean = city.split(',')[0].trim()
  if (!clean) return null

  const geo = await geocode(clean)
  if (!geo) return null

  const matchDate = new Date(isoDate)
  const dateStr = matchDate.toISOString().slice(0, 10)
  const fcKey = `fc_${geo.lat}_${geo.lon}_${dateStr}`
  let fc = getCache(fcKey)
  if (!fc) {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,is_day` +
      `&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`,
      { signal: AbortSignal.timeout(8000) }
    )
    fc = await res.json()
    if (!fc?.hourly?.time?.length) return null
    setCache(fcKey, fc, TTL_FC)
  }

  // Hora del pronóstico más cercana a la hora del partido (en la zona del estadio)
  const target = matchDate.getTime()
  let best = 0; let bestDiff = Infinity
  fc.hourly.time.forEach((t, i) => {
    const diff = Math.abs(new Date(t).getTime() - target)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })

  const tempC     = fc.hourly.temperature_2m?.[best]
  const precipMm  = fc.hourly.precipitation?.[best]
  const precipPct = fc.hourly.precipitation_probability?.[best]
  const windKmh   = fc.hourly.wind_speed_10m?.[best]
  const isNight   = fc.hourly.is_day?.[best] === 0

  return {
    city: geo.name,
    tempC:     tempC != null ? Math.round(tempC) : null,
    precipMm:  precipMm ?? null,
    precipPct: precipPct ?? null,
    windKmh:   windKmh != null ? Math.round(windKmh) : null,
    isNight,
    // Sugerencias automáticas para los checks del motor
    sugiereCalor:  tempC != null && tempC >= 32,
    sugiereLluvia: (precipMm != null && precipMm >= 1.5) || (precipPct != null && precipPct >= 70),
    resumen: [
      tempC != null ? `${Math.round(tempC)}°C` : null,
      precipPct != null ? `lluvia ${precipPct}%` : null,
      windKmh != null && windKmh >= 25 ? `viento ${Math.round(windKmh)} km/h` : null,
      isNight ? 'nocturno 🌙' : 'diurno ☀️',
    ].filter(Boolean).join(' · '),
  }
}
