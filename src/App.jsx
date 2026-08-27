import { useState, useCallback } from 'react'
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

function loadLeagueId() {
  try { return Number(localStorage.getItem(LEAGUE_STORAGE_KEY)) || DEFAULT_LEAGUE_ID } catch { return DEFAULT_LEAGUE_ID }
}

export default function App() {
  const [tab, setTab] = useState('fixture')
  const [leagueId, setLeagueId] = useState(loadLeagueId)
  const [analyzeTeams, setAnalyzeTeams] = useState({ teamAName: '', teamBName: '' })

  const league = getLeague(leagueId)

  const handleLeagueChange = useCallback((id) => {
    setLeagueId(Number(id))
    try { localStorage.setItem(LEAGUE_STORAGE_KEY, String(id)) } catch {}
  }, [])

  // Fixture → Analizar: pasa nombres (y liga si el partido es de otra competición)
  const handleAnalizar = useCallback((homeTeamName, awayTeamName, matchLeagueId) => {
    if (matchLeagueId && Number(matchLeagueId) !== leagueId) {
      handleLeagueChange(matchLeagueId)
    }
    setAnalyzeTeams({ teamAName: homeTeamName, teamBName: awayTeamName })
    setTab('analizar')
  }, [leagueId, handleLeagueChange])

  function renderContent() {
    if (tab === 'fixture')   return <Fixture league={league} onAnalizar={handleAnalizar} />
    if (tab === 'tabla')     return <LeagueStandings league={league} onAnalizar={handleAnalizar} />
    if (tab === 'analizar')  return <Analizar league={league} preloadTeams={analyzeTeams} />
    if (tab === 'vivo')      return <EnVivo league={league} />
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
