import { supabase } from './supabase'

const KEY = 'mundial2026_picks'
const hasSupabase = supabase !== null

// ── localStorage helpers ─────────────────────────────────
function lsGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function lsSet(picks) {
  localStorage.setItem(KEY, JSON.stringify(picks))
}

// ── Public API ───────────────────────────────────────────
export async function getPicks() {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('picks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) return data
  }
  return lsGet()
}

export async function savePick(pick) {
  const newPick = { ...pick, id: Date.now(), createdAt: new Date().toISOString() }
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('picks')
      .insert([{ ...newPick, created_at: newPick.createdAt }])
      .select()
      .single()
    if (!error) return data
  }
  const picks = lsGet()
  picks.unshift(newPick)
  lsSet(picks)
  return newPick
}

export async function updatePickResult(id, resultado) {
  if (hasSupabase) {
    await supabase.from('picks').update({ resultado }).eq('id', id)
  }
  const picks = lsGet()
  const idx = picks.findIndex(p => p.id === id)
  if (idx !== -1) { picks[idx].resultado = resultado; lsSet(picks) }
}

export async function deletePick(id) {
  if (hasSupabase) {
    await supabase.from('picks').delete().eq('id', id)
  }
  lsSet(lsGet().filter(p => p.id !== id))
}

// ── Stats (síncronas, reciben array ya cargado) ──────────
export function calcROI(picks) {
  const settled = picks.filter(p => p.resultado && p.resultado !== 'void')
  if (!settled.length) return 0
  const profit = settled.reduce((acc, p) =>
    p.resultado === 'ganado' ? acc + (p.cuota - 1) : acc - 1, 0)
  return +((profit / settled.length) * 100).toFixed(2)
}

export function hitRate(picks) {
  const settled = picks.filter(p => p.resultado && p.resultado !== 'void')
  if (!settled.length) return 0
  const wins = settled.filter(p => p.resultado === 'ganado').length
  return +((wins / settled.length) * 100).toFixed(1)
}
