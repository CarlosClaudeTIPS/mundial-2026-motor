# Motor Mundial 2026 ⚽

Aplicación web de análisis estadístico para apuestas deportivas del Mundial 2026.

## Stack

- **Frontend:** React 18 + Tailwind CSS + Vite
- **Base de datos:** Supabase (PostgreSQL)
- **APIs:** API-Football + The Odds API
- **Hosting:** Vercel

## Módulos

| Módulo | Descripción |
|--------|-------------|
| Grupos | Standings en tiempo real de los 12 grupos |
| Stats | Tabla completa de los 48 equipos (PPG, GF, GA, CS%, BTTS%) |
| Tiros | Tiros/partido, SOT, desglose 1H/2H |
| Córners | Córners/partido, Over/Under por línea |
| Goles | Goles, BTTS, CS%, Over/Under |
| Tarjetas | Tarjetas/partido, desglose 1H/2H |
| Saques | Saques de portería, banda, tiros libres |
| Analizar | Motor de análisis v2.0 con EV, Confidence y Risk |
| En Vivo | Recalculo en tiempo real con distribución de Poisson |
| Historial | ROI acumulado, Hit Rate por mercado |

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Editar .env con tus claves (ver sección Variables de entorno)

# 4. Correr en desarrollo
npm run dev
```

La app corre en http://localhost:5173

## Variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_API_FOOTBALL_KEY=tu-key-de-api-football
VITE_ODDS_API_KEY=tu-key-de-the-odds-api
```

> **Sin Supabase configurado**, la app funciona igual usando localStorage para el historial de picks y los datos de equipos hardcodeados.

## Supabase — Setup

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
3. Copia la **Project URL** y **anon key** desde Project Settings → API
4. Pégalas en tu `.env`

## Deploy en Vercel

```bash
# Opción A — CLI
npm i -g vercel
vercel

# Opción B — GitHub
# 1. Push a GitHub
# 2. Importar repo en vercel.com
# 3. Agregar variables de entorno en Settings → Environment Variables
# 4. Deploy automático en cada push a main
```

### Variables en Vercel

En el dashboard de Vercel → tu proyecto → Settings → Environment Variables, agrega:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_FOOTBALL_KEY`
- `VITE_ODDS_API_KEY`

## Cargar datos de equipos

Edita `src/lib/teams.js` y reemplaza los valores del array `TEAMS` con tu JSON de FootyStats.

Cada equipo sigue esta estructura:

```js
{
  id: 'argentina',
  name: 'Argentina',
  group: 'C',
  matches: 15,
  ppg: 2.1,
  gf_avg: 1.8,
  ga_avg: 0.9,
  cs_pct: 40,
  btts_pct: 38,
  shots_avg: 15.2,
  sot_avg: 6.1,
  shots_against_avg: 9.4,
  corners_avg: 6.2,
  corners_against_avg: 4.1,
  cards_avg: 1.8,
  throwins_avg: 42,
  goalkicks_avg: 18,
  freekicks_avg: 16,
  corners_1h: 3.1, corners_2h: 3.1,
  shots_1h: 7.2,  shots_2h: 8.0,
  sot_1h: 2.8,    sot_2h: 3.3,
  cards_1h: 0.7,  cards_2h: 1.1,
  goals_1h: 0.7,  goals_2h: 1.1,
  ou: {
    corners: { 7.5: 62, 8.5: 48, 9.5: 35, 10.5: 24 },
    goals:   { 1.5: 82, 2.5: 58, 3.5: 34 },
    sot:     { 7.5: 55, 8.5: 40, 9.5: 28 },
    cards:   { 1.5: 78, 2.5: 52, 3.5: 30, 4.5: 16 },
  }
}
```

## Motor de Análisis

Las fórmulas están en `src/lib/engine.js`:

- `calcExpectedCorners` — Expected Corners con Tactical K y Situation S
- `calcExpectedShots` — Expected Shots y SOT esperado
- `calcEV` — Expected Value y Value Score
- `calcConfidence` — Confidence Score (0-100)
- `calcRisk` — Risk Score (0-100) por perfil
- `poissonOver` — Probabilidad Over con distribución de Poisson
- `calcLiveExpected` — Proyección en vivo (ritmo × minutos restantes)

## Licencia

MIT
