import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import Grupos from './components/Grupos'
import StatsTable from './components/StatsTable'
import Analizar from './components/Analizar'
import EnVivo from './components/EnVivo'
import Historial from './components/Historial'
import Fixture from './components/Fixture'
import { TEAMS } from './lib/teams'

const STAT_TABS = ['stats', 'tiros', 'corners', 'goles', 'tarjetas', 'saques']

// Resolve team name string → team id (for Fixture → Analizar navigation)
function resolveTeamId(nameStr) {
  if (!nameStr) return ''
  const lower = nameStr.toLowerCase()
  const found = TEAMS.find(t =>
    t.id === lower.replace(/\s+/g, '_') ||
    t.name.toLowerCase() === lower ||
    t.id.replace(/_/g, ' ') === lower
  )
  return found?.id ?? ''
}

export default function App() {
  const [tab, setTab]             = useState('grupos')
  const [analyzeTeams, setAnalyzeTeams] = useState({ teamAId: '', teamBId: '' })

  const handleAnalizar = useCallback((homeTeamName, awayTeamName) => {
    const teamAId = resolveTeamId(homeTeamName)
    const teamBId = resolveTeamId(awayTeamName)
    setAnalyzeTeams({ teamAId, teamBId })
    setTab('analizar')
  }, [])

  function renderContent() {
    if (tab === 'grupos')   return <Grupos />
    if (tab === 'fixture')  return <Fixture onAnalizar={handleAnalizar} />
    if (STAT_TABS.includes(tab)) return <StatsTable tab={tab} />
    if (tab === 'analizar') return <Analizar preloadTeams={analyzeTeams} />
    if (tab === 'vivo')     return <EnVivo />
    if (tab === 'historial') return <Historial />
    return null
  }

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar active={tab} onChange={setTab} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav active={tab} onChange={setTab} />
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
