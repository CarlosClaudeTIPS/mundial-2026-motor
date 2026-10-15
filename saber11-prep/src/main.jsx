import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// PWA: cuando se instala una versión nueva de la app (service worker nuevo toma el
// control), se recarga la página una vez para no seguir mostrando la versión vieja.
// Solo si ya había un service worker activo: en la primera visita no recarga.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let recargado = false
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recargado) { recargado = true; window.location.reload() } })
}
// Además de la comprobación que hace el navegador al abrir la app, se busca una
// versión nueva al volver a la pestaña y cada 30 minutos, para que una app que
// se dejó abierta no se quede días con la versión vieja.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const buscar = () => { if (navigator.onLine) reg.update().catch(() => {}) }
    setInterval(buscar, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar() })
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
