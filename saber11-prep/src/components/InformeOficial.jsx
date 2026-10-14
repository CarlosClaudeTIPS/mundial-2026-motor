import { PRUEBAS, NOMBRE_NIVEL, textoComparacion, colorIncorrectas } from '../lib/informes'
import { formatoFecha } from '../lib/ciclo'

// ─── Reportes con el formato oficial del ICFES (sin logos ni marcas) ─────────
// Individual: "Reporte de resultados de estudiantes Saber 11" (Guía de orientación,
//   figura del reporte individual): identificación, puntaje global y percentil,
//   puntaje y percentil por prueba, niveles de desempeño con descriptores,
//   observaciones y "¿Cómo entender mis resultados?".
// Grupo: "Reporte de resultados del examen Saber 11° por aplicación" para
//   establecimientos: ficha técnica, resultados generales (promedio y desviación
//   con símbolos ▲▼• por tamaño del efecto), y por cada prueba: promedio y
//   desviación, porcentaje por niveles, gráfica de niveles y porcentaje de
//   respuestas incorrectas por aprendizaje con los colores del reporte.

const COLOR_NIVEL = { 1: '#E53E3E', 2: '#F6AD55', 3: '#F6E05E', 4: '#48BB78', 'A-': '#E53E3E', A1: '#F6AD55', A2: '#F6E05E', B1: '#9AE6B4', 'B+': '#48BB78' }
const COLOR_INCORRECTAS = { verde: '#48BB78', amarillo: '#F6E05E', naranja: '#F6AD55', rojo: '#E53E3E', gris: '#A0AEC0' }
const Simbolo = ({ s }) => (s ? <span className={`ml-1 font-semibold ${s === '▲' ? 'text-emerald-600' : s === '▼' ? 'text-red-500' : 'text-gray-400'}`}>{s}</span> : null)
const Seccion = ({ titulo, children }) => (
  <div className="rounded-xl border border-dark-600 overflow-hidden">
    <div className="bg-dark-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-navy">{titulo}</div>
    <div className="p-3">{children}</div>
  </div>
)
const Nota = ({ children }) => <p className="text-[11px] text-gray-500 leading-snug">{children}</p>

// Barra de percentil 0-100 con marcador, como "¿En qué percentil me encuentro? Usted está aquí".
function BarraPercentil({ valor, color = '#1FA9EC' }) {
  if (valor == null) return <p className="text-xs text-gray-500">Sin datos</p>
  return (
    <div className="relative h-5 mt-1">
      <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-dark-700" />
      <div className="absolute top-2 h-1.5 rounded-full" style={{ width: `${valor}%`, background: color }} />
      <div className="absolute -top-0.5 w-6 h-6 -ml-3 rounded-full text-[10px] font-bold flex items-center justify-center text-[#fff] shadow" style={{ left: `${valor}%`, background: color }}>{valor}</div>
      <span className="absolute left-0 top-5 text-[9px] text-gray-500">0</span><span className="absolute right-0 top-5 text-[9px] text-gray-500">100</span>
    </div>
  )
}

export function ReporteEstudiante({ inf, est, grupo = null, fechaAplicacion = null, observaciones = null }) {
  const hoy = new Date().toISOString()
  return (
    <div className="space-y-3 informe-oficial">
      <div className="rounded-xl border border-dark-600 p-3">
        <p className="text-lg font-bold tracking-wide text-brand-navy leading-tight">REPORTE DE RESULTADOS DE ESTUDIANTES</p>
        <p className="text-sm font-semibold text-gray-400">SABER 11 · Simulación de la plataforma (no es el reporte oficial del ICFES)</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
          <p><span className="text-gray-500">Fecha de aplicación:</span> {fechaAplicacion ? formatoFecha(fechaAplicacion) : 'práctica acumulada'}</p>
          <p><span className="text-gray-500">Fecha de publicación de resultados:</span> {formatoFecha(hoy)}</p>
          <p><span className="text-gray-500">Nombre:</span> {est.nombre}</p>
          <p><span className="text-gray-500">Usuario / registro:</span> {est.usuario} · {String(est.id).slice(0, 8).toUpperCase()}</p>
          <p><span className="text-gray-500">Establecimiento:</span> {est.colegio || grupo?.colegio || '—'}</p>
          <p><span className="text-gray-500">Grupo:</span> {grupo?.nombre || est.curso || '—'}</p>
        </div>
      </div>

      <Seccion titulo="Puntaje global">
        <div className="grid sm:grid-cols-2 gap-4 items-center">
          <div className="text-center">
            <p className="text-5xl font-bold text-brand-blue">{inf.global ?? '—'}</p>
            <p className="text-xs text-gray-500">de 500 puntos posibles{inf.global_parcial ? ' (parcial: faltan pruebas por responder)' : ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">¿En qué percentil me encuentro?</p>
            <p className="text-[11px] text-gray-500">Con respecto a los estudiantes del país, usted está aquí.</p>
            <BarraPercentil valor={inf.percentil_nacional} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Pruebas">
        <div className="grid grid-cols-[1fr_auto_1.2fr] gap-x-3 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><span>Prueba</span><span>De 100 puntos posibles, su puntaje es</span><span>¿En qué percentil me encuentro?</span></div>
        {inf.pruebas.map(p => (
          <div key={p.prueba} className="grid grid-cols-[1fr_auto_1.2fr] gap-x-3 items-center py-1.5 border-t border-dark-700 text-sm">
            <span className="font-medium">{p.nombre}</span>
            <span className="text-2xl font-bold text-center w-14">{p.puntaje ?? '—'}</span>
            <BarraPercentil valor={p.percentil_nacional} color={COLOR_NIVEL[p.nivel] ? '#1FA9EC' : '#1FA9EC'} />
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Sus niveles de desempeño">
        <div className="space-y-3">
          {inf.pruebas.map(p => (
            <div key={p.prueba} className="grid grid-cols-[6.5rem_2.5rem_1fr] gap-3 items-start border-t border-dark-700 pt-2 first:border-0 first:pt-0 break-inside-avoid">
              <p className="text-sm font-medium leading-tight">{p.nombre}</p>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold text-[#fff]" style={{ background: COLOR_NIVEL[p.nivel] ?? '#A0AEC0' }}>{p.nivel ?? '—'}</div>
              <div className="text-xs text-gray-300">
                {!p.descriptor ? <p className="text-gray-500">Sin respuestas en esta prueba.</p> : (
                  <>
                    <p className="text-gray-400 mb-1">{NOMBRE_NIVEL[p.nivel]} · puntaje {p.descriptor.rango[0]} a {p.descriptor.rango[1]}</p>
                    {p.descriptor.especificos.length ? <ul className="list-disc pl-4 space-y-0.5">{p.descriptor.especificos.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p>{p.descriptor.general}</p>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Observaciones">
        <p className="text-sm text-gray-300">{observaciones ?? 'Resultados estimados a partir de las respuestas del estudiante en la plataforma. No sustituyen el reporte oficial del ICFES.'}</p>
      </Seccion>

      <Seccion titulo="¿Cómo entender mis resultados?">
        <div className="grid sm:grid-cols-2 gap-3 text-[11px] text-gray-400 leading-snug">
          <div><p className="font-semibold text-gray-300">Puntaje global</p><p>Es obtenido a partir de la multiplicación del índice global del estudiante por 5. Este índice es calculado como el promedio ponderado de los puntajes obtenidos en las pruebas del examen. La ponderación asignada a la prueba de Inglés es de 1 punto y la de las demás pruebas es de 3 puntos. Este resultado se encuentra en una escala de 0 a 500 puntos sin decimales. Para comparar resultados a través del tiempo, la media del puntaje global definida en la primera aplicación del examen (2014-2) se fija en 250 puntos.</p></div>
          <div><p className="font-semibold text-gray-300">Puntaje por pruebas</p><p>Es el resultado cuantitativo que se obtiene a partir de la valoración de las respuestas dadas a las preguntas de cada prueba del examen. Este resultado se reporta en una escala de 0 a 100 puntos sin decimales. Para comparar resultados a través del tiempo, la media de la escala definida en la primera aplicación del examen (2014-2) se fija en 50 puntos y su desviación estándar en 10 puntos.</p></div>
          <div><p className="font-semibold text-gray-300">Percentil</p><p>El marcador indica en qué percentil se encuentra el resultado del evaluado (puntaje global o en alguna prueba del examen) con respecto a los resultados de los estudiantes colombianos. Si el puntaje global del evaluado estuviese ubicado en el percentil 81, este sería mayor a los puntajes globales obtenidos por el 81 % de los estudiantes colombianos que presentaron el examen, y menor o igual al 19 % restante.</p></div>
          <div><p className="font-semibold text-gray-300">Niveles de desempeño</p><p>Los niveles consisten en una descripción cualitativa del desempeño y complementan el puntaje obtenido por el evaluado, detallando las acciones que realiza para responder correctamente las preguntas formuladas de acuerdo a las competencias evaluadas en el examen. Se han definido cuatro niveles de desempeño para cada una de las pruebas, excepto para Inglés, donde los niveles establecidos son A-, A1, A2, B1 y B+. Los niveles de desempeño tienen como característica ser inclusivos, es decir que la descripción de un nivel recoge las acciones descritas en todos los anteriores.</p></div>
        </div>
        <Nota>En esta plataforma el puntaje de cada prueba es el porcentaje de aciertos y el percentil se calcula con la distribución nacional publicada en datos abiertos del ICFES ({inf.referencia?.periodo ? `periodo ${inf.referencia.periodo}` : ''}). El ICFES calcula sus puntajes con un modelo estadístico sobre toda la población; por eso estas cifras son una aproximación para orientar el estudio.</Nota>
      </Seccion>
    </div>
  )
}

export function ReporteGrupo({ inf, grupo = null, docente = null, fechaAplicacion = null }) {
  const hoy = new Date().toISOString()
  const nombreGrupo = grupo?.nombre ?? 'Grupo'
  const filasGenerales = [
    { nombre: 'Colombia', promedio: inf.media_nacional_global, desviacion: inf.desviacion_nacional_global, sp: inf.comparacion_global, sd: inf.comparacion_desviacion_global },
    { nombre: nombreGrupo, promedio: inf.global, desviacion: inf.desviacion_global, propio: true },
  ]
  return (
    <div className="space-y-3 informe-oficial">
      <div className="rounded-xl border border-dark-600 p-3">
        <p className="text-lg font-bold tracking-wide text-brand-navy leading-tight">REPORTE DE RESULTADOS DEL EXAMEN SABER 11° POR APLICACIÓN</p>
        <p className="text-sm font-semibold text-gray-400">Establecimientos educativos · Simulación de la plataforma (no es el reporte oficial del ICFES)</p>
        <p className="text-xs text-gray-400 mt-2">Este reporte incluye comparaciones a través de las cuales podrá saber cómo son los resultados del grupo con respecto a los resultados de Colombia (distribución nacional de datos abiertos del ICFES{inf.referencia?.periodo ? `, periodo ${inf.referencia.periodo}` : ''}).</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
          <p><span className="text-gray-500">Fecha de aplicación:</span> {fechaAplicacion ? formatoFecha(fechaAplicacion) : 'práctica acumulada'}</p>
          <p><span className="text-gray-500">Fecha de actualización de datos:</span> {formatoFecha(hoy)}</p>
          <p><span className="text-gray-500">Establecimiento:</span> {grupo?.colegio || '—'}</p>
          <p><span className="text-gray-500">Grupo / curso:</span> {nombreGrupo}{grupo?.curso ? ` · ${grupo.curso}` : ''}</p>
          {docente && <p><span className="text-gray-500">Docente:</span> {docente}</p>}
        </div>
      </div>

      <Seccion titulo="1. Ficha técnica">
        <p className="text-xs font-semibold mb-1">Tabla 1.1 Número de estudiantes matriculados, inscritos, presentes y con resultados publicados</p>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 text-left"><th className="py-1">Nivel de agregación</th><th className="text-right">Matriculados</th><th className="text-right">Inscritos</th><th className="text-right">Presentes</th><th className="text-right">Con resultados</th></tr></thead>
          <tbody>
            <tr className="border-t border-dark-700"><td className="py-1">Colombia</td><td className="text-right" colSpan={4}>{inf.ficha?.n_nacional?.toLocaleString('es-CO') ?? 'N.D.'} evaluados con resultados publicados</td></tr>
            <tr className="border-t border-dark-700 font-medium"><td className="py-1">{nombreGrupo}</td><td className="text-right">{inf.ficha?.matriculados}</td><td className="text-right">{inf.ficha?.inscritos}</td><td className="text-right">{inf.ficha?.presentes}</td><td className="text-right">{inf.ficha?.con_resultados}</td></tr>
          </tbody>
        </table>
        <Nota>Matriculados: estudiantes del grupo en la plataforma. Inscritos: con cuenta activa. Presentes: con al menos una respuesta en la base elegida. Con resultados: con respuestas en las cinco pruebas (puntaje global completo).</Nota>
      </Seccion>

      <Seccion titulo="2. Resultados generales">
        <p className="text-xs font-semibold mb-1">Tabla 2.1 Promedio del puntaje global y desviación estándar</p>
        <TablaPromedio filas={filasGenerales} />
        <LecturaResultados que="el promedio del puntaje global" sp={inf.comparacion_global} sd={inf.comparacion_desviacion_global} nombre={nombreGrupo} />
        <Nota>Promedio del puntaje global: representa el desempeño medio de los estudiantes. Se reporta en una escala de 0 a 500 puntos, sin decimales; la media de la escala en la primera aplicación (2014-2) se fijó en 250 puntos. Desviación estándar: medida de dispersión; cuanto más alta, más alejados del promedio están los resultados de los estudiantes. Símbolos: • similar, ▲ considerablemente mayor, ▼ considerablemente menor que Colombia (comparación por tamaño del efecto).</Nota>
      </Seccion>

      {inf.pruebas.map((p, idx) => {
        const n = idx + 3
        const filas = [
          { nombre: 'Colombia', promedio: p.media_nacional, desviacion: p.desviacion_nacional, sp: p.comparacion_media, sd: p.comparacion_desviacion },
          { nombre: nombreGrupo, promedio: p.media, desviacion: p.desviacion, propio: true },
        ]
        return (
          <Seccion key={p.prueba} titulo={`${n}. ${p.nombre}`}>
            {p.evaluados === 0 ? <p className="text-sm text-gray-500">N.D.: no hay información disponible.</p> : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold mb-1">Tabla {n}.1 Promedio y su desviación estándar en {p.nombre}</p>
                  <TablaPromedio filas={filas} />
                  <LecturaResultados que={`el promedio en ${p.nombre}`} sp={p.comparacion_media} sd={p.comparacion_desviacion} nombre={nombreGrupo} />
                  <Nota>Promedio en escala de 0 a 100 puntos; la media de la escala en la primera aplicación (2014-2) se fijó en 50 puntos y su desviación estándar en 10.</Nota>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Tabla {n}.2 Porcentaje de estudiantes por niveles de desempeño en {p.nombre}</p>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-500 text-left"><th className="py-1">Nivel de agregación</th>{p.distribucion_niveles.map(x => <th key={x.nivel} className="text-right">{x.nivel}</th>)}</tr></thead>
                    <tbody>
                      <tr className="border-t border-dark-700"><td className="py-1">Colombia</td>{p.distribucion_niveles.map(x => <td key={x.nivel} className="text-right">{x.pct_nacional ?? 'N.D.'}{x.pct_nacional != null && ' %'}<Simbolo s={x.comparacion} /></td>)}</tr>
                      <tr className="border-t border-dark-700 font-medium"><td className="py-1">{nombreGrupo}</td>{p.distribucion_niveles.map(x => <td key={x.nivel} className="text-right">{x.pct} %</td>)}</tr>
                    </tbody>
                  </table>
                  <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                    {p.distribucion_niveles.map(x => <p key={x.nivel}>El porcentaje de estudiantes de {nombreGrupo} en el nivel de desempeño {x.nivel} ({x.n} estudiante{x.n === 1 ? '' : 's'}) es <b>{x.comparacion ? textoComparacion[x.comparacion].toLowerCase() : 'N.D.'}</b> al de Colombia.</p>)}
                  </div>
                  <Nota>Niveles de desempeño: descripción cualitativa que complementa el promedio. Son particulares (definidos para cada prueba), jerárquicos (el de mayor complejidad es el 4, y B+ en Inglés) e inclusivos (para estar en un nivel se requiere haber superado los inferiores). Los símbolos junto a Colombia indican si el porcentaje del grupo es ▲ mayor, ▼ menor o • igual al nacional (comparación directa). La suma puede no ser exactamente 100 % por redondeo.</Nota>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Gráfica {n}.3 Porcentaje de estudiantes por niveles de desempeño en {p.nombre}</p>
                  <BarraNiveles filas={[{ nombre: 'Colombia', dist: p.distribucion_niveles.map(x => ({ nivel: x.nivel, pct: x.pct_nacional })) }, { nombre: nombreGrupo, dist: p.distribucion_niveles }]} />
                  <Nota>El escenario ideal es aquel en el cual los segmentos de color verde y amarillo ocupen la mayor parte de la barra.</Nota>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Figura {n}.4 Porcentaje promedio de respuestas incorrectas en cada aprendizaje evaluado en {p.nombre}</p>
                  {p.aprendizajes.length === 0 ? <p className="text-sm text-gray-500">N.D.: no hay información disponible.</p> : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-gray-500 text-left"><th className="py-1">Aprendizaje</th><th className="text-right whitespace-nowrap">Colombia</th><th className="text-right whitespace-nowrap">{nombreGrupo}</th></tr></thead>
                      <tbody>
                        {p.aprendizajes.map((a, i) => (
                          <tr key={i} className="border-t border-dark-700">
                            <td className="py-1.5 pr-2 text-xs leading-snug">{a.afirmacion}<span className="text-gray-500"> · {a.total} respuestas</span></td>
                            <td className="text-right text-gray-500">N.D.</td>
                            <td className="text-right whitespace-nowrap"><span className="inline-block w-3 h-3 rounded-full align-middle mr-1" style={{ background: COLOR_INCORRECTAS[colorIncorrectas(a.pct_error)] }} />{a.pct_error} %</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <Nota>Colores según el porcentaje promedio de respuestas incorrectas: verde menor al 20 %; amarillo de 20 % a menos de 40 %; naranja de 40 % a menos de 70 %; rojo 70 % o más. Cuanto menor sea el porcentaje, mejor el desempeño. El nivel de dificultad de cada afirmación es diferente, por lo que no se comparan entre sí. Colombia: N.D., el ICFES no publica este dato en datos abiertos.</Nota>
                </div>
              </div>
            )}
          </Seccion>
        )
      })}
    </div>
  )
}

function TablaPromedio({ filas }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-xs text-gray-500 text-left"><th className="py-1">Nivel de agregación</th><th className="text-right">Promedio</th><th className="text-right">Desviación</th></tr></thead>
      <tbody>
        {filas.map(f => (
          <tr key={f.nombre} className={`border-t border-dark-700 ${f.propio ? 'font-medium' : ''}`}>
            <td className="py-1">{f.nombre}</td>
            <td className="text-right">{f.promedio ?? 'N.D.'}<Simbolo s={f.sp} /></td>
            <td className="text-right">{f.desviacion ?? 'N.D.'}<Simbolo s={f.sd} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LecturaResultados({ que, sp, sd, nombre }) {
  if (!sp && !sd) return null
  return (
    <div className="text-xs text-gray-400 mt-2 space-y-0.5">
      <p className="font-semibold text-gray-300">Lectura de resultados</p>
      {sp && <p>{que[0].toUpperCase() + que.slice(1)} obtenido por {nombre} es considerablemente <b>{textoComparacion[sp].toLowerCase()}</b> al de los establecimientos educativos de Colombia.</p>}
      {sd && <p>La desviación estándar {que.replace(/^el /, 'del ')} obtenida por {nombre} es considerablemente <b>{textoComparacion[sd].toLowerCase()}</b> a la de los establecimientos educativos de Colombia{sd === '▼' ? ' (resultados más homogéneos)' : sd === '▲' ? ' (resultados más dispersos: unos muy altos y otros muy bajos)' : ''}.</p>}
    </div>
  )
}

function BarraNiveles({ filas }) {
  return (
    <div className="space-y-2">
      {filas.map(f => (
        <div key={f.nombre} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 text-gray-400 truncate">{f.nombre}</span>
          <div className="flex-1 flex h-5 rounded overflow-hidden bg-dark-900">
            {f.dist.filter(x => x.pct).map(x => <div key={x.nivel} className="flex items-center justify-center text-[10px] font-semibold text-[#222]" style={{ width: `${x.pct}%`, background: COLOR_NIVEL[x.nivel] }} title={`Nivel ${x.nivel}: ${x.pct} %`}>{x.pct >= 8 ? `${x.pct}%` : ''}</div>)}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">{filas[1].dist.map(x => <span key={x.nivel} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLOR_NIVEL[x.nivel] }} /> Nivel {x.nivel}</span>)}</div>
    </div>
  )
}
