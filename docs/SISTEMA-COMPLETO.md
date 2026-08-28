# SISTEMA CUANTITATIVO DE APUESTAS DE FÚTBOL — Documento maestro para revisión externa

> Propósito: este documento describe COMPLETO el sistema para que otra IA (o un analista) lo audite y proponga mejoras. Incluye arquitectura, fórmulas, constantes, fuentes de datos con sus limitaciones reales, y las debilidades conocidas. Al final hay preguntas concretas para el revisor.

## 1. Contexto

App web (Vite + React, 100% client-side, persistencia en localStorage, sin backend) para un tipster individual en Colombia. Analiza fútbol PREMATCH y LIVE en ~28 ligas. Mercados cuantitativos: **córners, tiros, tiros a puerta (SOT), tarjetas, saques de banda (TI), saques de portería (GK)** + motor prematch clásico de goles/faltas. El usuario ingresa a mano la línea y cuota de su casa de apuestas; el sistema devuelve BET/NO BET. Meta operativa del usuario: **combinadas de 2 picks con cuota total ≥ 1.50**. Gestión de bankroll fija: $25.000 COP máx/apuesta, 4 apuestas/día, bloqueo tras 2 pérdidas seguidas.

## 2. Fuentes de datos (con limitaciones REALES)

| Fuente | Da | Limitaciones |
|---|---|---|
| Live-Score API (trial→€11/mes) | Fixtures, standings, stats por partido y EN VIVO por equipo: tiros, SOT, bloqueados, córners, tarjetas, faltas, posesión, ataques peligrosos | GK siempre null; TI solo en partidos recientes; 1500 calls/día; feed live mezcla estados; stats de partidos viejos/copas a veces vacías |
| Sofascore (gratis, solo fetch desde navegador — curl/serverless = 403) | TI, GK, centros, xG, big chances por partido; árbitro (amarillas/partido); alineaciones + bajas; incidentes (amonestados con minuto); cuotas básicas (1X2, a veces goles) | Sin API oficial; definiciones pueden diferir ±1-2 del bookie; cuotas SIN córners/tarjetas |
| Open-Meteo (gratis) | Clima por coordenadas/ciudad a la hora del partido | Solo contexto visual, peso cero en modelos |
| SIN FUENTE (peso CERO declarado) | PPDA, presión por zonas, posesión territorial, zonas de tiro, tipos de falta, duelos, transiciones, perfiles por jugador, cuotas de cierre (CLV) | — |

## 3. Arquitectura (regla global)

```
buildTeamStats (SOLO partidos terminados; mediana con filtros de plausibilidad;
  ponderación últimos 5 ×30% + últimos 10 ×70%; ajuste por división para ascendidos;
  relleno TI/GK/centros/xG desde Sofascore por fecha)
  → PRIOR por mercado (interacción 60% lo que genera A + 40% lo que concede B,
     anclado 50/50 a la mediana empírica de TOTALES de sus últimos partidos)
  → PREMATCH BASELINE congelado (localStorage, no se pisa nunca)
  → LIVE: mezcla bayesiana w = min/(min+K) entre ritmo observado y prior
     (K por mercado: córners 28, tiros 26, TI 30, GK 32, tarjetas 38)
  → MATCH STATE ENGINE compartido (match-state.js): minutos efectivos restantes
     (~95' con añadido), régimen reciente (ventana ~8-10', clamp ±15%, aplicado ^0.5),
     presión (ataques peligrosos/min vs baseline 1.1, clamp ±12% ^0.5),
     TARJETA ROJA estructural (el de 10 genera ×0.80, rival ×1.08; GK inverso)
  → Distribución BINOMIAL NEGATIVA sobre lo restante (PHI: córners 1.30, tiros 1.45,
     SOT 1.25, TI 1.40, GK 1.35, tarjetas 1.20) → escalera P(Over) por línea + intervalo 10-90%
  → MARKET ENGINE unificado: implícita (sin vig si hay ambas cuotas), edge = p_modelo − p_implícita,
     EV = p×cuota−1, umbral dinámico (base 4pp; +2 conf<65; +2 temprano; +1 sin Under;
     +1-1.5 mercado por equipo; +1 con roja), señal BET solo si edge ≥ umbral Y conf ≥ 50
     Y minuto ≥ mínimo del mercado; calidad A/B/C provisional
  → Opportunity Ranking por partido + aviso de correlación (grupos: tempo =
     córners/tiros/SOT/tarjetas/goles · pausas = TI/GK) + audit log de cada evaluación
```

Particularidades por mercado:
- **Tarjetas**: hazard temporal (curva acumulada: 15'→9%, 45'→38%, 75'→73%) — el nivel del partido se estima como acum/H(min), NO extrapolación lineal. Prior causal: faltas esperadas × tasa tarjeta/falta propia (50/50 con promedio) + 40% de lo que el rival provoca + factor árbitro real (amarillas/partido de Sofascore ÷ 4.2, clamp 0.80-1.25). "Próxima tarjeta" = carrera de Poisson entre lados.
- **Tiros**: coherencia contable exacta — total por lado es el conteo principal; SOT y bloqueados anclados a acumulados reales y "fuera" = residuo. Proporción a puerta = mezcla del % propio con el % que la defensa rival permite. xG/tiro solo diagnóstico (cantidad ≠ calidad).
- **Córners**: por lado con Situation S del marcador (0.82-1.28, suavizada ^0.7 — la evidencia marcador→córners es fuerte); drivers: ataques peligrosos + tiros bloqueados. "Próximo córner" = carrera de Poisson.
- **GK**: driver causal = tiros DESVIADOS del rival (proxy tiros−SOT, clamp ±10% ^0.5); correlación GK↔posesión ≈ −0.72 en el prior; marcador ±8%.
- **TI**: marcador acotado ±6% (evidencia débil, declarado); estilo por bandas desde centros reales (≥20/partido = 'bandas', Tactical_K ≤ ×1.10).

Confianza (0-100, separada de la probabilidad): fuente del dato (directo/alterno/manual), minutos jugados, muestra del prior, snapshots, acuerdo modelo-vs-naive, árbitro presente (tarjetas), roja (−5). Explicabilidad: cada pick lista factores a favor/en contra usados de verdad (promedio últimos 10, forma últimos 5 con valores, concesión del rival, dificultad del rival = concesión vs media de liga ±8% y diferencia PPG ≥0.5, localía, estilo). Un dato a ±0.3 de la línea se declara "EN la línea, no decide".

## 4. Backtesting y calibración (infraestructura lista, DATOS AÚN ACUMULÁNDOSE)

- Live-logs por mercado (localStorage): snapshot por minuto con SOLO la información disponible en ese momento + baseline prematch; resolución automática con stats finales (Live-Score; GK vía Sofascore por fecha). Métricas por tramo (5-20'...80-95'): MAE, acierto direccional sobre la línea central, Brier. Comparación MAE prematch vs live. Partidos con roja marcados.
- Backtest prematch: predicciones guardadas antes del partido (snapshot 7 días, nunca pisado >24h), auto-resueltas, error y sesgo por mercado y liga ("las líneas de córners están altas/bajas").
- Sin leakage: excludeFixtureId en backtests; baselines congelados; nada del futuro en snapshots.
- **NO calibrado aún**: faltan ~20 partidos resueltos por mercado. Kelly deliberadamente NO implementado hasta calibrar. CLV no medible (sin cuotas de cierre).

## 5. Debilidades conocidas (sé honesto conmigo, revisor)

1. Todas las constantes (K, PHI, clamps, hazard, factores de roja ×0.80/×1.08, factor árbitro, Situation S suavizada, umbral 4pp, calidad A/B/C) son **a priori razonados, NO ajustados a datos propios**. La infraestructura de recalibración existe; los datos no todavía.
2. Poisson/NB asumen tasa constante en el resto (salvo tarjetas con hazard). Córners/tiros también se concentran algo al final — ¿debería haber hazard en todos?
3. La mezcla bayesiana w=min/(min+K) es una credibilidad clásica, no aprendida.
4. Independencia entre lados dentro de un mercado (el total = suma de dos NB independientes) — el tempo compartido entra solo vía factores comunes.
5. Correlación entre mercados: solo grupos cualitativos con aviso; sin cópula/matriz numérica.
6. Priors con ventanas de 10-14 partidos (limitación de API) — sin datos de temporada completa ni multi-temporada.
7. localStorage por dispositivo: los registros de PC y laptop no se suman.
8. Las cuotas las ingresa el usuario a mano; sin odds feed para nuestros mercados nicho (córners/tarjetas: The Odds API las tiene para ligas grandes con key gratis 500 créditos/mes — pendiente; saques: NINGUNA API las lista).
9. Sofascore es semi-oficial: puede cambiar endpoints o bloquear sin aviso.
10. Prórrogas (copas) manejadas de forma simple (restante hasta 120').

## 6. Preguntas concretas para el revisor

1. ¿Priorizarías hazard temporal en córners/tiros como en tarjetas? ¿Con qué forma funcional y cómo la validarías con ~30 partidos?
2. ¿Hay mejor alternativa a NB con PHI fijo por mercado con muestras tan chicas (empirical Bayes, jerárquico liga→equipo)?
3. ¿Cómo estimarías la dependencia entre lados y entre mercados (cópula gaussiana sobre los conteos?) sin sobreajustar con pocos datos?
4. ¿El umbral de edge dinámico (4pp + castigos) es defendible o recomendarías umbral por mercado calibrado por Brier/curvas de fiabilidad desde el inicio?
5. ¿Qué protocolo de recalibración recomiendas cuando lleguen 20-50 partidos por mercado (qué se toca primero: K, PHI, factores de estado)?
6. Para la meta del usuario (combinadas 2 patas ≥1.50): ¿el criterio "P conjunta ≥ 1.025/1.50 = 68.3%" es el correcto, o recomendarías margen extra por correlación/incertidumbre de modelo?
7. ¿Qué señal de las que usamos eliminarías por débil/redundante, y qué variable disponible en nuestras fuentes está desaprovechada?
8. ¿Riesgos metodológicos que no estemos viendo (además de los listados)?
