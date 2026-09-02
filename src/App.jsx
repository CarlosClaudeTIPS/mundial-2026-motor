import { useState, useCallback, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import LeagueStandings from './components/LeagueStandings'
import Analizar from './components/Analizar'
import EnVivo from './components/EnVivo'
import Historial from './components/Historial'
import Fixture from './components/Fixture'
import BankrollTracker from './components/bankroll/BankrollTracker'
import Rendimiento from './components/Rendimiento'
import Buscar from './components/Buscar'
import Predicciones from './components/Predicciones'
import { getLeague, DEFAULT_LEAGUE_ID } from './lib/leagues'

const LEAGUE_STORAGE_KEY = 'motor_selected_league'
const TAB_STORAGE_KEY = 'motor_tab_actual'

function loadLeagueId() {
  try { return Number(localStorage.getItem(LEAGUE_STORAGE_KEY)) || DEFAULT_LEAGUE_ID } catch { return DEFAULT_LEAGUE_ID }
}

// Al recargar, volver a la pestaña donde estabas (no a la primera)
function loadTab() {
  try { return localStorage.getItem(TAB_STORAGE_KEY) || 'fixture' } catch { return 'fixture' }
}

// URL con partido incluido: #analizar?league=140&h=Barcelona&a=Levante&hid=1&aid=2
// (permite abrir un análisis en una pestaña nueva sin perder donde ibas)
function parseHashInicial() {
  try {
    const h = (window.location.hash || '').slice(1)
    if (!h) return {}
    const [tab, qs] = h.split('?')
    const p = new URLSearchParams(qs || '')
    const out = { tab: tab || null }
    if (p.get('league')) out.league = Number(p.get('league'))
    if (p.get('h') && p.get('a')) {
      out.teams = {
        teamAName: p.get('h'), teamBName: p.get('a'),
        teamAId: p.get('hid') ? Number(p.get('hid')) : undefined,
        teamBId: p.get('aid') ? Number(p.get('aid')) : undefined,
      }
    }
    return out
  } catch { return {} }
}
const NAV_INICIAL = parseHashInicial()

export default function App() {
  const [tab, setTabRaw] = useState(() => NAV_INICIAL.tab || loadTab())
  const [leagueId, setLeagueId] = useState(() => NAV_INICIAL.league ?? loadLeagueId())
  const [analyzeTeams, setAnalyzeTeams] = useState(() => NAV_INICIAL.teams ?? { teamAName: '', teamBName: '' })
  // Petición de abrir el Fixture en modo "Solo esta liga" (clic en el nombre de la liga)
  const [soloLigaReq, setSoloLigaReq] = useState(null)
  const desdePop = useRef(false)

  const league = getLeague(leagueId)

  // ── Historial del navegador: "atrás" navega DENTRO de la app ──
  // Cada cambio de pestaña se apila; el botón atrás vuelve a la anterior
  // en vez de sacarte de la página.
  const setTab = useCallback((t) => {
    setTabRaw(t)
    try {
      localStorage.setItem(TAB_STORAGE_KEY, t)
      if (!desdePop.current) window.history.pushState({ tab: t }, '', `#${t}`)
      desdePop.current = false
    } catch {}
  }, [])

  useEffect(() => {
    // Estado inicial en el historial (para que el primer "atrás" tenga a dónde volver)
    try { window.history.replaceState({ tab }, '', `#${tab}`) } catch {}
    const onPop = (e) => {
      const t = e.state?.tab || (window.location.hash || '#').slice(1)
      if (t) {
        desdePop.current = true
        setTabRaw(t)
        try { localStorage.setItem(TAB_STORAGE_KEY, t) } catch {}
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeagueChange = useCallback((id) => {
    setLeagueId(Number(id))
    try { localStorage.setItem(LEAGUE_STORAGE_KEY, String(id)) } catch {}
    // Elegir una liga en el selector = quiero VER esa liga → el Fixture pasa
    // a "Solo esa liga" (antes se quedaba en "Mis ligas" y parecía vacío)
    setSoloLigaReq({ ts: Date.now() })
  }, [])

  // Clic en el nombre de una liga → Fixture en modo "Solo esa liga"
  const handleVerLiga = useCallback((ligaId) => {
    if (ligaId && Number(ligaId) !== leagueId) handleLeagueChange(ligaId)
    setSoloLigaReq({ ts: Date.now() })
    setTab('fixture')
  }, [leagueId, handleLeagueChange, setTab])

  // Fixture → Analizar: pasa nombres + IDs (y liga si el partido es de otra competición)
  const handleAnalizar = useCallback((homeTeamName, awayTeamName, matchLeagueId, ids) => {
    if (matchLeagueId && Number(matchLeagueId) !== leagueId) {
      handleLeagueChange(matchLeagueId)
    }
    setAnalyzeTeams({ teamAName: homeTeamName, teamBName: awayTeamName, teamAId: ids?.homeId, teamBId: ids?.awayId })
    setTab('analizar')
  }, [leagueId, handleLeagueChange, setTab])

  function renderContent() {
    if (tab === 'fixture')   return <Fixture league={league} onAnalizar={handleAnalizar} soloLigaReq={soloLigaReq} onVerLiga={handleVerLiga} />
    if (tab === 'tabla')     return <LeagueStandings league={league} onAnalizar={handleAnalizar} />
    if (tab === 'analizar')  return <Analizar league={league} preloadTeams={analyzeTeams} onVerLiga={handleVerLiga} />
    if (tab === 'vivo')      return <EnVivo league={league} onVerLiga={handleVerLiga} />
    if (tab === 'buscar')    return <Buscar />
    if (tab === 'rendimiento') return <Rendimiento />
    if (tab === 'historial') return <Historial />
    if (tab === 'predicciones') return <Predicciones league={league} />
    if (tab === 'bankroll')  return <BankrollTracker />
    return null
  }

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar active={tab} onChange={setTab} leagueId={leagueId} onLeagueChange={handleLeagueChange} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav active={tab} onChange={setTab} leagueId={leagueId} onLeagueChange={handleLeagueChange} />
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
