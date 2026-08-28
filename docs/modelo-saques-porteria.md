# Modelo cuantitativo de Saques de Portería (Goal Kicks) LIVE

**Principio**: Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
NO BET es salida válida y frecuente. Código: `src/lib/goalkicks.js` · UI: `src/components/GkQuant.jsx` (pestaña En Vivo).

## 1. Definición del evento (§1 del spec)

Usamos el conteo **"Goal kicks" de Sofascore** (fuente principal — Live-Score reporta GK = null siempre). Cuenta el reinicio con saque de portería: balón que cruza la línea de fondo tocado por última vez por el atacante, **sin** ser gol ni córner. **No cuenta**: córners, paradas del portero (el balón no salió), tiros bloqueados que no salen, goles, jugadas anuladas por falta/offside previo. La definición del bookie puede diferir ±1 — la confianza castiga la fuente alterna (−5 vs dato directo).

## 2. Causalidad — NO es "más tiros = más GK"

El generador directo son los **tiros DESVIADOS del rival** (fuera del arco) + centros/pases profundos que cruzan la línea de fondo. Con nuestras fuentes:

- `offTarget ≈ Tiros totales − Tiros a puerta`. **Limitación honesta**: incluye bloqueados cuando la fuente no los separa, y el bloqueado que no sale NO genera GK → el proxy sobreestima. Por eso el coeficiente es suave (clamp ±10%, aplicado ^0.5).
- La correlación **GK↔posesión ≈ −0.72** (el dominado despeja y recibe tiros → saca más de portería) vive en el prior vía `calcExpectedGK`: modifica por posesión del rival y diferencia de nivel PPG.
- Zona/ángulo/distancia del tiro, tipo de centro, altura del bloque, salida corta/larga del portero, PPDA, posesión territorial: **sin fuente → peso CERO** (no se inventa).

## 3. Inventario de variables

| Variable | Fuente | Disp. | Peso |
|---|---|---|---|
| GK acumulados + minuto | Sofascore live (LS = null) | LIVE | Núcleo: peso bayesiano `min/(min+32)` |
| Mediana GK/partido + GK que PROVOCA el rival | Sofascore hist. + amistosos | PRE | 50% del prior (interacción por equipo, spec §18: expA/expB separados) |
| Mediana empírica de TOTALES | ídem | PRE | 50% del prior + desviación real |
| Tiros desviados/min vs esperado | LS/Sofascore live | LIVE | clamp ±10%, ^0.5 (proxy imperfecto) |
| Marcador × minuto | LS live | LIVE | clamp **±8%** (perdedor bombardea → fallos → GK del ganador; resuelto tarde → nadie patea) |
| Ritmo reciente ~8-10 min | snapshots propios | LIVE | clamp ±15%, ^0.5 |
| Posesión, diferencia de nivel | LS | PRE | dentro de calcExpectedGK, no se recuenta |

**Doble conteo evitado**: ataques/ataques peligrosos NO entran (correlacionan con tiros, que ya está vía offTarget); posesión solo en el prior.

## 4. Modelo

Idéntica arquitectura que TI (ver `docs/modelo-saques-banda.md`): mezcla bayesiana prior/observado, **Binomial Negativa** con `PHI = 1.35` (los GK son algo menos dispersos que los TI), intervalo 10–90%, escalera P(Over) por línea. Constantes recalibrables en `GK_MODEL`.

## 5. Edge y decisión

Igual que TI: implícita (sin vig con ambas cuotas), umbral 4 pp dinámico (+2 confianza<65, +2 antes del 20', +1 sin cuota Under), señal BET solo con edge ≥ umbral **y** confianza ≥ 50 **y** minuto ≥ 12. Confianza separada de probabilidad, con desglose.

## 6. Live-backtest sin leakage

Mismo registro que TI (`makeLiveLog`, storage `motor_gk_livelog_v1`): snapshot por minuto con solo la información de ese momento; resolución automática al terminar — **vía Sofascore por fecha** (Live-Score nunca trae GK). MAE/acierto/Brier por tramo de minuto en el panel.

## 7. Fuentes gratis agregadas (contexto, peso cero por ahora)

- **Sofascore lineups/árbitro/estadio** (`fetchSofaContexto`): formación, titulares, bajas con motivo, confirmada vs probable, árbitro con amarillas/partido, estadio y coordenadas. Se MUESTRA (tarjeta "Contexto del partido") — sin coeficiente hasta que el backtest lo soporte.
- **Open-Meteo** (`src/lib/clima.js`, sin API key): temperatura, lluvia (mm y prob.), viento a la hora del partido, geocoding por ciudad como fallback. Banderas: lluvia (≥0.3mm o prob ≥60%), viento fuerte (≥30 km/h). Candidatos a factor: lluvia→TI, viento→GK largos; entran solo si el live-backtest lo demuestra.
- **No viables desde el navegador** (CORS/sin API): FBref, WhoScored, StatsBomb open data → sirven para calibración OFFLINE de pesos, no para la app en vivo.
- **The Odds API** (gratis 500 req/mes): requiere key propia (`VITE_ODDS_API_KEY`); útil para favorito/implícitas pre — los mercados de saques casi nunca están listados, las líneas se seguirán ingresando a mano.
