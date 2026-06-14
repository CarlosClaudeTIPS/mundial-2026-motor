// Historial de picks — localStorage (sin Supabase configurado)
const KEY = 'mundial2026_picks'

export function getPicks() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function savePick(pick) {
  const picks = getPicks()
  const newPick = { ...pick, id: Date.now(), createdAt: new Date().toISOString() }
  picks.unshift(newPick)
  localStorage.setItem(KEY, JSON.stringify(picks))
  return newPick
}

export function updatePickResult(id, resultado) {
  const picks = getPicks()
  const idx = picks.findIndex(p => p.id === id)
  if (idx === -1) return
  picks[idx].resultado = resultado
  localStorage.setItem(KEY, JSON.stringify(picks))
}

export function deletePick(id) {
  const picks = getPicks().filter(p => p.id !== id)
  localStorage.setItem(KEY, JSON.stringify(picks))
}

export function calcROI(picks) {
  const settled = picks.filter(p => p.resultado && p.resultado !== 'void')
  if (!settled.length) return 0
  const profit = settled.reduce((acc, p) => {
    if (p.resultado === 'ganado') return acc + (p.cuota - 1)
    return acc - 1
  }, 0)
  return +((profit / settled.length) * 100).toFixed(2)
}

export function hitRate(picks) {
  const settled = picks.filter(p => p.resultado && p.resultado !== 'void')
  if (!settled.length) return 0
  const wins = settled.filter(p => p.resultado === 'ganado').length
  return +((wins / settled.length) * 100).toFixed(1)
}
