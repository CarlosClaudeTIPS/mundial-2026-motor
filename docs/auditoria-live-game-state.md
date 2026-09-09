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

## 3. Lo que NO se hizo (a propósito) y por qué

- No se cambió el baseline ni se promovió el experimental: falta el backtest comparado (§55-57). Criterio: `maeExp < maeBaseVsExp` de forma consistente por tramo, fuera de muestra, con ≥50 partidos por mercado.
- No hay fatiga, sustituciones ni cambios ofensivos: las fuentes no dan sustituciones fiables → `NOT_AVAILABLE`, no se inventan.
- La "respuesta observada" se mide con tiros (producción ofensiva). Para córners se usa como proxy declarado; SOT hereda la proporción del baseline (§31: sin evidencia de que el share cambie por estado).
- TI/GK no reciben game state (§35: sin evidencia).

## 4. Cómo se valida a partir de ahora

1. Dejar correr partidos en vivo con los paneles abiertos: cada snapshot registra ambas proyecciones.
2. Cuando MODEL HEALTH muestre ≥50 partidos por mercado, comparar "GS exp" vs baseline por tramo. Ganar en 65'-95' (donde el estado importa) y no perder en 5'-35'.
3. Solo entonces: MODEL CHANGE PROPOSAL para que el experimental decida.
