// ─── Informe IA pre-partido — Claude con búsqueda web ────────────────────────
// Esto es lo que ninguna API de stats da: noticias, alineaciones probables,
// bajas de última hora, clima y contexto de prensa. Claude busca en internet
// y contrasta lo que encuentra con los números del motor.

import Anthropic from '@anthropic-ai/sdk'

const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || null
const CACHE_KEY = 'motor_ia_cache_v1'
const TTL = 6 * 3600_000 // 6h — las noticias pre-partido cambian rápido

export function hasIA() {
  return !!KEY
}

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

export async function informePrePartido({ teamA, teamB, league, calc }) {
  if (!KEY) throw new Error('Falta VITE_ANTHROPIC_API_KEY en .env.local')

  const cacheKey = `informe_${teamA.id}_${teamB.id}`
  const cached = getCache(cacheKey)
  if (cached) return { ...cached, fromCache: true }

  const client = new Anthropic({ apiKey: KEY, dangerouslyAllowBrowser: true })

  const notasMotor = [
    `Goles esperados: ${calc.t.goals} (${teamA.name} ${calc.adj.goalsA} · ${teamB.name} ${calc.adj.goalsB})`,
    `Tiros totales: ${calc.t.shots} · SOT: ${calc.t.sot}`,
    `Córners: ${calc.t.corners} · Tarjetas: ${calc.t.cards} · Faltas: ${calc.fouls.total}`,
    `Throw-ins: ${calc.t.ti} · Saques de portería: ${calc.t.gk}`,
    `Posesión promedio: ${teamA.name} ${teamA.possession_avg}% · ${teamB.name} ${teamB.possession_avg}%`,
    teamA.tierAdj ? `OJO: ${teamA.name} recién ascendido — sus stats vienen de división inferior (ya descontadas)` : null,
    teamB.tierAdj ? `OJO: ${teamB.name} recién ascendido — sus stats vienen de división inferior (ya descontadas)` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Eres el analista de un motor de apuestas deportivas. Analiza el PRÓXIMO partido entre ${teamA.name} y ${teamB.name} (${league.name}).

BUSCA EN INTERNET (fuentes recientes, últimas 48-72h):
1. Fecha, hora y estadio del próximo ${teamA.name} vs ${teamB.name}
2. Alineaciones probables o confirmadas de ambos
3. Lesiones, sanciones y bajas de última hora — nombres concretos y cuánto pesan
4. Noticias relevantes: crisis, cambios de técnico, declaraciones, rotaciones previstas (¿juegan copa entre semana?)
5. Clima previsto en la ciudad del estadio para ese día
6. Racha y contexto real de cada equipo esta temporada

NÚMEROS DE NUESTRO MOTOR (calculados con stats reales de los últimos 10 partidos):
${notasMotor}

ENTREGA EL INFORME EN ESPAÑOL, en este formato exacto:

📅 EL PARTIDO
(fecha, hora, estadio, clima previsto)

🏥 BAJAS Y ALINEACIONES
(por equipo: bajas con nombre e impacto, XI probable si se conoce)

📰 CONTEXTO
(3-5 puntos: noticias, motivación, rotaciones, racha)

⚖️ VEREDICTO vs NUESTRO MOTOR
(contrasta lo que encontraste con nuestros números: ¿los valida o los contradice? sé directo — si una baja o rotación cambia el panorama de tiros/goles/córners, dilo con el ajuste que harías)

🎯 CONCLUSIONES APOSTABLES
(máximo 3, concretas, con la condición: "X si la cuota supera Y" cuando aplique)

Sé concreto y honesto: si no encuentras algo, dilo en una línea y sigue. No inventes datos.`

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    tools: [{
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 6,
    }],
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()

  const busquedas = response.content.filter(b => b.type === 'server_tool_use').length

  const out = { texto, busquedas, ts: Date.now() }
  setCache(cacheKey, out)
  return out
}
