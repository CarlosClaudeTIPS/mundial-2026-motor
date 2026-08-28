# Modelo cuantitativo de Saques de Banda (Throw-ins) LIVE

**Principio**: Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
NO BET es una salida válida y frecuente. Código: `src/lib/throwins.js` · UI: `src/components/TiQuant.jsx` (pestaña En Vivo).

## 1. Inventario de variables — qué se usa, con qué peso y por qué

Formato: **Variable → fuente → disponibilidad → relación esperada → evidencia → peso en el modelo → riesgo**

### Evidencia FUERTE (núcleo del modelo)

| Variable | Fuente | Disp. | Relación | Peso |
|---|---|---|---|---|
| TI acumulados + minuto | Live-Score / Sofascore live | LIVE | directa (es la variable objetivo parcial) | Núcleo: ritmo observado, peso bayesiano `min/(min+30)` |
| Mediana TI/partido últimos 10-14 (propio) | Live-Score hist. + Sofascore | PRE | los equipos tienen niveles estables de TI (banda vs interior) | 60% del prior de interacción |
| TI que el rival CONCEDE (ti_against) | ídem | PRE | interacción A×B, no promedios aislados: quien presiona en banda provoca saques del rival | 40% del prior de interacción |
| Mediana empírica de TOTALES (A+B por partido) | ídem | PRE | ancla la escala del total y da la desviación estándar real | 50% del prior final (mezcla con interacción) |

- Se usa **mediana con filtro de plausibilidad (TI≥8)**, no media: la API reporta partidos parciales que arrastran la media hacia abajo (bug ya sufrido y corregido en el motor).
- **Doble conteo evitado**: `throwins_avg` y la mediana de totales miden lo mismo desde dos ángulos → se mezclan 50/50, nunca se suman como factores independientes.

### Evidencia MEDIA (coeficientes pequeños, acotados)

| Variable | Fuente | Disp. | Relación | Peso (acotado) |
|---|---|---|---|---|
| Ritmo últimos ~8-10 min vs ritmo del partido | snapshots propios cada 60s | LIVE | cambio de régimen (el partido se calienta/enfría) | factor^0.5, clamp ±15% |
| Marcador × minuto | Live-Score live | LIVE | partidos cerrados tarde ↑ juego por banda/reloj parado; ventaja amplia tarde ↓ reinicios | clamp **±6%** (el efecto del marcador sobre TI es mucho menor que sobre córners/tiros — no se copia el Situation S de córners, que llega a ±28%) |
| Estilo por bandas (centros/partido Sofascore ≥20) | Sofascore | PRE | ataque por banda → más pérdidas/despejes laterales | ×1.10 máx en el prior (antes ×1.22: recortado por falta de backtest que soporte tanto) |
| Normalización por liga (kTI) | `leagues.js` (baselines) | PRE | 42 TI en una liga ≠ 42 en otra (ritmo, tiempo efectivo) | multiplicador 0.90–1.12 del prior |
| Posesión relativa | Live-Score | PRE/LIVE | dominante saca más en campo rival | ya dentro de `calcExpectedTI` prepartido, clamp ±10%; NO se recuenta en vivo |

### SIN DATO en nuestras fuentes → **peso CERO** (no se inventa)

PPDA / presión por zonas · posesión territorial / width pressure · ataques por izquierda/derecha · pases largos y cambios de orientación · duelos 1v1 en banda · alineaciones (extremos/laterales titulares, anchura) · clima por estadio · dimensiones del campo · árbitro · congestión de calendario/fatiga cuantificada.

Cuando alguna fuente futura los traiga, entran primero al log del live-backtest y **solo reciben peso si mejoran el error fuera de muestra**.

## 2. Modelo estadístico

- **Prior prepartido**: mezcla 50/50 de (a) interacción propio×rival con estilo y liga, (b) mediana empírica de totales. Da media y desviación reales.
- **Live**: tasa mezclada `w·rate_obs + (1−w)·rate_prior` con `w = min/(min+30)` (al 30' pesa 50/50, al 80' domina lo observado). Minutos efectivos ~95' (añadido). NO es extrapolación lineal: la tasa se corrige por estado del partido y régimen reciente.
- **Distribución**: **Binomial Negativa** sobre los saques restantes con sobredispersión `var = 1.40·media`. Los conteos de TI de partido muestran var/media ≈ 1.3–1.5 (Poisson puro subestima las colas → sobreestima la confianza en líneas lejanas). `PHI` es una constante exportada y recalibrable con el live-backtest local.
- **Alternativas evaluadas**: Poisson (rechazado: subdispersa), regresión/GBM/XGBoost (rechazados por ahora: no hay dataset histórico minuto-a-minuto para entrenarlos sin overfit; el live-backtest local está construyendo ese dataset). Jerárquico bayesiano = la mezcla de credibilidad implementada es su versión simple y honesta.

## 3. Edge y decisión

- P(Over línea) del modelo vs **implícita de la casa**; con cuota Over+Under se quita el vig (implícita sin margen); con una sola cuota se penaliza el umbral +1pp.
- **Umbral mínimo 4 pp**, dinámico: +2pp si confianza <65, +2pp antes del 20'.
- Señal `BET` solo si: edge ≥ umbral **y** confianza ≥ 50 **y** minuto ≥ 12. Todo lo demás → `NO BET`.
- La **confianza (0-100)** mide calidad/estabilidad (fuente del dato, minutos, muestra del prior, acuerdo modelo-vs-naive), **no** probabilidad de ganar. Desglose visible con "¿por qué?".

## 4. Live-backtest (sin leakage)

Cada refresco de 60s guarda snapshot `{min, ti, proyección, p(línea central)}` usando **solo información disponible en ese minuto**. Al terminar el partido se resuelve con el TI final real (una llamada a la API, reintentos espaciados). El panel muestra MAE, acierto y Brier **por tramo de minuto** (5-20', 20-35', ... 80-95') → responde "¿desde qué minuto es confiable el modelo?". Registro local `motor_ti_livelog_v1`, cap 50 partidos.

**Recalibración**: con ≥20 partidos resueltos, revisar (1) PHI real (var/media de errores), (2) K de credibilidad, (3) si el factor marcador ±6% aporta o se elimina, (4) sesgo del prior por liga.

## 5. Limitaciones conocidas (honestidad)

- Live-Score casi nunca trae TI en vivo → la fuente habitual es Sofascore, cuya **definición puede diferir ±1-2** del conteo del bookie. La confianza lo castiga (-5 vs dato directo).
- Sin cuotas históricas de cierre → no hay CLV ni ROI backtesteado todavía; el registro local lo irá construyendo.
- El factor marcador×minuto para TI tiene evidencia débil en la literatura (a diferencia de córners); por eso está acotado a ±6% y es candidato a eliminarse si el backtest no lo soporta.
- Trial de Live-Score: 1500 llamadas/día — la resolución de logs se limita a 2 por ciclo.
