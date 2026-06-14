import { useState } from 'react'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import Grupos from './components/Grupos'
import StatsTable from './components/StatsTable'
import Analizar from './components/Analizar'
import EnVivo from './components/EnVivo'
import Historial from './components/Historial'

const STAT_TABS = ['stats', 'tiros', 'corners', 'goles', 'tarjetas', 'saques']

export default function App() {
  const [tab, setTab] = useState('grupos')

  function renderContent() {
    if (tab === 'grupos') return <Grupos />
    if (STAT_TABS.includes(tab)) return <StatsTable tab={tab} />
    if (tab === 'analizar') return <Analizar />
    if (tab === 'vivo') return <EnVivo />
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
