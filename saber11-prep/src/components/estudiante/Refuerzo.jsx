import { useEffect, useState } from 'react'
import { BookOpen, Play, Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react'
import lecciones from '../../../content/lecciones.json'
import { intentosDe, listarRecursos } from '../../lib/datos'
import { diagnosticoDe } from '../../lib/pruebas'
import { listarPreguntas } from '../../lib/banco'
import { resumen } from '../../lib/analitica'
import { taxonomia, nombrePrueba } from '../../lib/taxonomia'
import { ir } from '../../lib/nav'
import { MATERIAS } from '../Login'
import { Titulo, FilaMetrica, Badge, Vacio } from '../ui'

// ─── Refuerzo: enseñanza dirigida a lo que está flojo ───────────────────────
// Parte del diagnóstico (y de todo lo respondido después): por cada competencia
// con precisión baja muestra qué evalúa, cómo abordarla, errores típicos, un
// ejemplo, recursos de la biblioteca y práctica dirigida.

export default function Refuerzo({ usuario }) {
  const [d, setD] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const tax = taxonomia()

  useEffect(() => {
    (async () => {
      const [intentos, diag, preguntas, recursos] = await Promise.all([intentosDe(usuario.id), diagnosticoDe(usuario.id), listarPreguntas(), listarRecursos({ estado: 'aprobado' })])
      const porId = Object.fromEntries(preguntas.map(p => [p.id, p]))
      const r = resumen(intentos, porId)
      const conteoBanco = {}
      for (const p of preguntas) conteoBanco[p.competencia] = (conteoBanco[p.competencia] ?? 0) + 1
      // Competencias con datos: flojas (< 60 %), en proceso (60-74), fuertes (≥ 75). Sin datos: por evaluar.
      const comps = tax.competencias.map(c => {
        const x = r.por_competencia.find(y => y.id === c.id)
        const nivel = !x || x.total < 2 ? 'sin_datos' : x.precision < 60 ? 'floja' : x.precision < 75 ? 'proceso' : 'fuerte'
        return { ...c, total: x?.total ?? 0, precision: x?.precision ?? null, nivel, enBanco: conteoBanco[c.id] ?? 0 }
      })
      const habs = r.por_habilidad.filter(h => h.total >= 4 && h.precision < 60)
      setD({ r, diag, comps, habs, recursos, n: intentos.length })
    })()
  }, [usuario.id])

  if (!d) return <p className="text-sm text-gray-400">Cargando…</p>
  const flojas = d.comps.filter(c => c.nivel === 'floja')
  const proceso = d.comps.filter(c => c.nivel === 'proceso')
  const sinDatos = d.comps.filter(c => c.nivel === 'sin_datos')
  const orden = ['floja', 'proceso', 'sin_datos', 'fuerte']
  const lista = [...d.comps].sort((a, b) => orden.indexOf(a.nivel) - orden.indexOf(b.nivel) || (a.precision ?? 0) - (b.precision ?? 0))

  return (
    <div className="space-y-4">
      <Titulo sub="Lo que está flojo, explicado y con práctica dirigida">Refuerzo</Titulo>

      {!d.diag && (
        <div className="rounded-2xl p-4 bg-gradient-to-r from-brand-blue to-indigo-500 text-[#fff]">
          <p className="font-semibold">Empieza por la prueba diagnóstica</p>
          <p className="text-sm opacity-90">Con ella la app detecta en qué competencias necesitas refuerzo. Mientras tanto, aquí ves lo que se sabe con lo que has respondido.</p>
          <button className="mt-3 rounded-xl bg-[#fff] text-brand-blue font-semibold px-4 py-2" onClick={() => ir('simulacros')}>Ir a la prueba diagnóstica</button>
        </div>
      )}
      {d.diag?.estado === 'terminada' && (
        <div className="card flex items-center gap-3">
          <CheckCircle2 className="text-brand-green shrink-0" />
          <p className="text-sm">Diagnóstico: <b>{d.diag.resultado?.precision}%</b> de aciertos. Con lo que respondas después, este plan se actualiza solo.</p>
          <button className="btn-ghost text-xs shrink-0" onClick={() => ir('sesion', { id: d.diag.id })}>Ver detalle</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card !p-3"><p className="text-2xl font-bold text-brand-red">{flojas.length}</p><p className="text-xs text-gray-500">competencias flojas</p></div>
        <div className="card !p-3"><p className="text-2xl font-bold text-brand-amber">{proceso.length}</p><p className="text-xs text-gray-500">en proceso</p></div>
        <div className="card !p-3"><p className="text-2xl font-bold text-gray-500">{sinDatos.length}</p><p className="text-xs text-gray-500">por evaluar</p></div>
      </div>

      {d.habs.length > 0 && (
        <div className="card">
          <p className="font-semibold flex items-center gap-2 mb-2"><Lightbulb size={18} className="text-brand-amber" /> Hábitos que te están costando puntos</p>
          {d.habs.map(h => {
            const l = lecciones.habilidades[h.id]
            return (
              <div key={h.id} className="rounded-xl bg-dark-900 p-3 mb-2">
                <p className="text-sm font-medium">{h.nombre} · {h.precision}% de aciertos en {h.total} preguntas</p>
                {l && <p className="text-sm text-gray-300 mt-1">{l.consejo}</p>}
                {l && <p className="text-xs text-gray-500 mt-1">Ejercicio: {l.practica}</p>}
                <button className="btn-secondary !py-1.5 text-xs mt-2" onClick={() => ir('practica', { habilidad: h.id, n: 5, verificacion: h.id === 'verificar' ? '1' : undefined })}><Play size={14} /> Practicar esta habilidad</button>
              </div>
            )
          })}
        </div>
      )}

      {d.n === 0 && <Vacio>Todavía no hay respuestas. Haz la prueba diagnóstica o practica un poco y vuelve aquí.</Vacio>}

      <div className="space-y-2">
        {lista.map(c => {
          const m = MATERIAS.find(x => x.id === c.prueba)
          const l = lecciones.competencias[c.id]
          const recs = d.recursos.filter(r => r.competencia === c.id || (r.prueba === c.prueba && r.categoria === 'esencial')).slice(0, 3)
          const tono = c.nivel === 'floja' ? 'rojo' : c.nivel === 'proceso' ? 'ambar' : c.nivel === 'fuerte' ? 'verde' : 'gris'
          const etiqueta = c.nivel === 'floja' ? 'Refuerzo prioritario' : c.nivel === 'proceso' ? 'En proceso' : c.nivel === 'fuerte' ? 'Fuerte' : 'Por evaluar'
          return (
            <div key={c.id} className="card p-3" style={{ borderLeft: `4px solid ${m?.color ?? '#ccc'}` }}>
              <button className="w-full text-left" onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{nombrePrueba(c.prueba)}</p>
                    <p className="font-medium text-brand-navy">{c.nombre}</p>
                  </div>
                  <Badge tono={tono}>{etiqueta}</Badge>
                </div>
                {c.precision != null && <div className="mt-2"><FilaMetrica nombre={`${c.total} respuestas`} valor={c.precision} /></div>}
              </button>
              {abierta === c.id && l && (
                <div className="mt-3 border-t border-dark-700 pt-3 space-y-3 text-sm">
                  <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Qué evalúa</p><p>{l.que_evalua}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Cómo lo preguntan</p><p className="text-gray-300">{l.como_se_pregunta}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Cómo abordarlo, paso a paso</p><ol className="list-decimal pl-5 space-y-1">{l.pasos.map(p => <li key={p}>{p}</li>)}</ol></div>
                  <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Errores típicos</p><ul className="list-disc pl-5 space-y-1 text-gray-300">{l.errores_tipicos.map(e => <li key={e}>{e}</li>)}</ul></div>
                  <div className="rounded-xl bg-sky-50 border border-sky-200 p-3"><p className="text-xs uppercase tracking-wide text-sky-700 mb-1">Ejemplo</p><p>{l.ejemplo}</p></div>
                  {recs.length > 0 && (
                    <div><p className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><BookOpen size={12} /> Material de apoyo</p>
                      {recs.map(r => <p key={r.id} className="text-sm">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-brand-blue underline">{r.titulo} ↗</a> : r.titulo}</p>)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary !py-2" onClick={() => ir('practica', { competencia: c.id, dificultad: c.nivel === 'floja' ? 1 : undefined, n: 5 })}><Play size={16} /> Practicar 5 de esta competencia</button>
                    <button className="btn-secondary !py-2" onClick={() => ir('materia', { id: c.prueba })}>Ver la materia</button>
                  </div>
                  <p className="text-xs text-gray-500">{c.enBanco} preguntas de esta competencia en el banco.</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
