# Auditoría LIVE — game state, ritmo, fuerza y respuesta (2026-09-09)

Respuesta a la auditoría de 67 puntos. Regla aplicada: **AUDITAR → implementar como EXPERIMENTAL en paralelo → comparar contra baseline → promover solo con evidencia**. PAPER MODE intacto. Ningún parámetro congelado (PHI, K, tempo, roja, umbrales) se tocó.

## 1. Qué hacía el motor live ANTES (auditoría honesta)

| Pieza | Dónde | Qué usaba | Qué NO usaba |
|---|---|---|---|
| μ restante por lado | `shots.js` `mkSide`, `corners.js` `mkSide` | rateBlend (obs vs prior con K) × restante efectivo × `getSituationS(diff)` × régimen reciente (±15%, ventana 8') × presión (ataques peligrosos) × roja | **tiempo restante** en el efecto del marcador, **fuerza relativa**, **respuesta observada vs baseline propio**, tendencia multi-escala, dominio, cierre |
| Ajuste por marcador | `engine.getSituationS` | solo la diferencia de goles (−1 ×1.18, +1 ×0.93…) | 0-1 al 20' = 0-1 al 85'; favorito perdiendo = colista perdiendo; pierde-y-responde = pierde-y-no-responde |
| Game State Engine | `game-state.js` (desde 29/8) | marcador × tiempo × fuerza (PPG + volumen) × respuesta observada; ritmo corto/medio/partido con detección de pico; dominio; persecución efectiva; cierre | **estaba desconectado**: solo alimentaba `GameStatePanel` (diagnóstico). No entraba en proyecciones, ni en logs, ni en explicaciones de picks |
| Explicación live | `shotsFactores` | frases sobre ritmo/S/régimen/presión | no explicaba el estado del partido; no había "qué cambió" |
| Backtest | `makeLiveLog.summary` | MAE/Brier/CRPS por tramo del baseline vs naive | no existía comparación baseline vs game state |

Conclusión: la intuición del usuario era correcta. El motor proyectaba "promedio × minutos × marcador plano".

## 2. Qué se implementó (EXPERIMENTAL, en paralelo)

- `shotsLiveModel` y `cornersLiveModel` aceptan `gs` (vector de estado de `buildGameState`). Calculan una **segunda proyección** (`expectedFinalExp`, `muRestExp`, `pOverExp`, y para SOT `sotFinalExp`) en la que el factor de marcador plano se reemplaza por `stateResponseExp` (marcador × tiempo restante × fuerza relativa × respuesta observada), con la MISMA atenuación (`STATE_SOFT`) y el resto del pipeline idéntico. **La decisión (pOver, edge, señal) sigue saliendo del baseline** — test que lo garantiza.
- Los live-logs guardan por snapshot `projExp`, `muExp`, `pCentralExp`; `summary()` devuelve por tramo `maeExp` vs `maeBaseVsExp` (mismos snapshots, mismo final) y `brierExp`. MODEL HEALTH muestra la columna "GS exp".
- `live-explain.js`: explicación estructurada SITUACIÓN · RESPUESTA · RITMO · TIEMPO · OPONENTE · PROYECCIÓN · RIESGO · DECISIÓN, derivada únicamente de las contribuciones calculadas (`Marcador`, `Tiempo restante`, `Fuerza relativa`, `Respuesta observada`). "Qué cambió" compara el snapshot anterior (minuto, acumulado, proyecciones, P de la línea central, marcador, respuesta, tendencia, cierre) y nombra el factor que más pesa.
- `GameStateExp.jsx` dentro de los paneles de tiros y córners.
- Tests nuevos: baseline idéntico con/sin gs; favorito-perdiendo-respondiendo sube; colista-perdiendo-sin-responder baja; córners misma invariante; explicación desde contribuciones reales; "qué cambió".

## 2b. Motivación automática desde la tabla (mismo día)

`src/lib/motivacion.js` — `situacionTabla(tabla, equipo, {type})` lee la clasificación ya cargada y deduce por equipo: posición, puntos al descenso / a salvarse / a Europa / al líder, partidos restantes (2·(n−1) − pj), fase por partidos jugados (<20 % inicio, >80 % final), y una **motivación** en la escala que ya usaba `context.js` (`necesita_ganar`, `ganar_o_empatar`, `cualquier_result`, `ya_clasificado`) más una **urgencia 0..1**. Zonas: descenso (3 bajan en ligas de 20, 2 en ligas menores), riesgo (≤3 pts del descenso), título (líder o ≤3 del líder), Europa (≤3 de los puestos de arriba), nada en juego (solo en recta final, ≥8 pts de ambos), media tabla. Inicio de temporada y copas → neutro (el check de eliminación ya pesa).

Dónde entra:
- **Prematch (Analizar)**: pre-llena `motA`/`motB`/`jornada` del contexto → los modificadores existentes (necesita ganar: tiros ×1.20, córners ×1.18, tarjetas ×1.25; sin nada en juego: ×0.85/×0.88/×0.80) se aplican solos. Se muestra bajo la clasificación con la razón ("16º, a 2 pts del descenso, 6 partidos por jugar → necesita ganar") y el usuario puede cambiarlo en Contexto.
- **Live (experimental)**: `stateResponseExp` recibe `urgencia`; modula el EFECTO del marcador ±8 % solo cuando el equipo no va ganando (el que gana y se juega algo, administra igual). Aparece como contribución "Motivación (tabla)" y en la línea MOTIVACIÓN de la explicación.
- Tarjetas: no se tocó el modelo validado; la relación "pierde → más faltas → más tarjetas" queda como hipótesis a medir con los logs (marcador y urgencia ya se registran).

## 2c. Recién ascendidos (dato del proveedor, no a mano)

`src/lib/ascendidos.js` — `ascendidosDeLiga(leagueId, tablaActual)`: Live-Score da `seasons/list.json` (ids y nombres) y `competitions/standings.json?season=<id>`; se pide la tabla de la temporada anterior (1 llamada por liga cada 7 días, caché) y un equipo es "recién ascendido" si está en la tabla actual y no estaba en la anterior (por id, con respaldo por nombre). Verificado 9/9 con datos reales: LaLiga 26/27 → Deportivo, Racing Santander, Málaga; Premier → Hull, Ipswich, Coventry; Serie A → Frosinone, Monza, Venezia.

Efecto: en `situacionTabla` el ascendido sube su urgencia (+0.15) y nunca queda "sin nada en juego" (mínimo `ganar_o_empatar`, incluso a inicio de temporada). Su menor calidad ya la descontaba `league-stats` por el tier de sus partidos recientes; ahora además queda marcado toda la temporada (⬆️ en la clasificación) y entra en la explicación live.

Todo esto está en el trial de Live-Score: pagar no añade datos para esta función, solo cuota diaria.

## 3. Lo que NO se hizo (a propósito) y por qué

- No se cambió el baseline ni se promovió el experimental: falta el backtest comparado (§55-57). Criterio: `maeExp < maeBaseVsExp` de forma consistente por tramo, fuera de muestra, con ≥50 partidos por mercado.
- No hay fatiga, sustituciones ni cambios ofensivos: las fuentes no dan sustituciones fiables → `NOT_AVAILABLE`, no se inventan.
- La "respuesta observada" se mide con tiros (producción ofensiva). Para córners se usa como proxy declarado; SOT hereda la proporción del baseline (§31: sin evidencia de que el share cambie por estado).
- TI/GK no reciben game state (§35: sin evidencia).

## 4. Cómo se valida a partir de ahora

1. Dejar correr partidos en vivo con los paneles abiertos: cada snapshot registra ambas proyecciones.
2. Cuando MODEL HEALTH muestre ≥50 partidos por mercado, comparar "GS exp" vs baseline por tramo. Ganar en 65'-95' (donde el estado importa) y no perder en 5'-35'.
3. Solo entonces: MODEL CHANGE PROPOSAL para que el experimental decida.
