import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// PWA: cuando se instala una versión nueva de la app (service worker nuevo toma el
// control), se recarga la página una vez para no seguir mostrando la versión vieja.
// Solo si ya había un service worker activo: en la primera visita no recarga.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let recargado = false
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recargado) { recargado = true; window.location.reload() } })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
