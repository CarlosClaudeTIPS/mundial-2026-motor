// ─── Clima del partido — Open-Meteo (gratis, sin API key, CORS abierto) ──────
// Se usa como CONTEXTO VISIBLE: lluvia/viento se muestran pero NO pesan en los
// modelos hasta que el live-backtest demuestre utilidad (spec: variables
// secundarias sin peso arbitrario). La lluvia fuerte es candidata a factor TI.

const CACHE_KEY = 'motor_clima_v1'
const TTL = 2 * 3600_000 // 2 horas

function getCache(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const e = raw[key]
    if (!e || Date.now() - e.ts > TTL) return null
    return e.data
  } catch { return null }
}
function setCache(key, data) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    raw[key] = { data, ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw))
  } catch {}
}

// Geocodificar ciudad → lat/lon (Open-Meteo geocoding, gratis)
async function geocode(city) {
  const key = `geo_${city.toLowerCase()}`
  const cached = getCache(key)
  if (cached) return cached
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`geocoding ${res.status}`)
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) throw new Error(`ciudad "${city}" no encontrada`)
  const out = { lat: hit.latitude, lon: hit.longitude, name: hit.name }
  setCache(key, out)
  return out
}

// Clima en el estadio a la hora del partido (o ahora, si ya está en juego)
// Acepta lat/lon directos (de Sofascore) o nombre de ciudad como fallback.
export async function fetchClima({ lat = null, lon = null, city = null, whenTs = Date.now() }) {
  if (lat == null || lon == null) {
    if (!city) return null
    const g = await geocode(city)
    lat = g.lat; lon = g.lon
  }

  const key = `wx_${lat.toFixed(2)}_${lon.toFixed(2)}_${new Date(whenTs).toISOString().slice(0, 13)}`
  const cached = getCache(key)
  if (cached) return cached

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m&timezone=UTC&forecast_days=2&past_hours=6`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`open-meteo ${res.status}`)
  const data = await res.json()
  const h = data.hourly
  if (!h?.time?.length) return null

  // Hora más cercana al inicio del partido
  const target = whenTs
  let best = 0; let bestDiff = Infinity
  for (let i = 0; i < h.time.length; i++) {
    const diff = Math.abs(new Date(h.time[i] + 'Z').getTime() - target)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  }

  const out = {
    temp: h.temperature_2m?.[best] ?? null,
    lluviaMm: h.precipitation?.[best] ?? null,
    probLluvia: h.precipitation_probability?.[best] ?? null,
    vientoKmh: h.wind_speed_10m?.[best] ?? null,
    // banderas interpretadas
    lluvia: (h.precipitation?.[best] ?? 0) >= 0.3 || (h.precipitation_probability?.[best] ?? 0) >= 60,
    vientoFuerte: (h.wind_speed_10m?.[best] ?? 0) >= 30,
    hora: h.time[best],
  }
  setCache(key, out)
  return out
}
