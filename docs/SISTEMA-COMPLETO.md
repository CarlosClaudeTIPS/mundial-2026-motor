# SISTEMA CUANTITATIVO DE APUESTAS DE FÚTBOL — Documento maestro v2 (post-refactor metodológico)

> Para revisión externa (otra IA o analista). v1 fue auditada; este documento describe el sistema DESPUÉS de implementar esa auditoría. Al final: qué se implementó de la revisión anterior, qué quedó pendiente y las nuevas preguntas.

## 1. Contexto

App web (Vite + React, 100% client-side, localStorage, sin backend) para un tipster individual en Colombia. Fútbol PREMATCH y LIVE, ~28 ligas. Mercados cuantitativos: **córners, tiros, SOT, tarjetas, saques de banda (TI), saques de portería (GK)** + motor prematch clásico de goles/faltas. Líneas y cuotas las ingresa el usuario a mano. Meta operativa: **combinadas de 2 picks con cuota total ≥ 1.50**. Bankroll fijo: $25.000 COP máx/apuesta, 4/día, bloqueo tras 2 pérdidas.

**ESTADO GLOBAL: MODO PAPER.** `CALIBRACION = 'sin-calibrar'`: toda señal positiva se emite como **PAPER BET** (registrar y seguir, no ventaja demostrada). Cada panel muestra "Modelo BASELINE (heurístico, sin calibrar)". El BET real se activará solo con calibración demostrada. Ningún parámetro ha sido ajustado a datos propios; todos los heurísticos están declarados (lista en §7).

## 2. Fuentes de datos (limitaciones reales)

| Fuente | Da | Limitaciones |
|---|---|---|
| Live-Score API (trial→€11/mes) | Fixtures, stats por partido y EN VIVO por equipo: tiros, SOT, bloqueados, córners, tarjetas, faltas, posesión, ataques peligrosos | GK siempre null; TI solo partidos recientes; 1500 calls/día; partidos viejos/copas a veces sin stats |
| Sofascore (gratis, solo navegador; 403 desde servidores) | TI, GK, centros, xG por partido; árbitro (amarillas/partido); alineaciones y bajas; incidentes (amonestados); cuotas básicas 1X2 | Semi-oficial (puede cambiar/bloquear); definiciones ±1-2 vs bookie; tratado como enriquecimiento con castigo de confianza, no single-point-of-failure |
| Open-Meteo (gratis) | Clima a la hora del partido | Solo display, peso cero |
| SIN FUENTE (peso CERO declarado) | PPDA, zonas, duelos, transiciones, perfiles por jugador, cuotas de cierre automáticas | The Odds API (córners/tarjetas, 500 créditos/mes) pendiente de key del usuario |

## 3. Pipeline

```
buildTeamStats (SOLO partidos terminados; medianas con filtros de plausibilidad;
  ponderación 30/70 últimos 5/10; ajuste por división; relleno TI/GK/xG de Sofascore)
→ PRIOR por mercado (interacción 60% genera A + 40% concede B, anclado 50/50
  a la mediana empírica de totales; splits localía en tiros)
→ PREMATCH BASELINE congelado (no se pisa nunca)
→ LIVE: w = min/(min+K) entre ritmo observado y prior (K: córners 28, tiros 26,
  TI 30, GK 32, tarjetas 38) — K fijo declarado como BASELINE a reemplazar por
  w = f(minuto, nº eventos, calidad, estabilidad) cuando haya datos
→ MATCH STATE ENGINE compartido: restante efectivo (~95'), régimen reciente
  (±15% ^0.5), presión DA (±12% ^0.5), ROJA estructural con contexto
  (×0.80 propio / ×1.08 rival; GK inverso; atenuada ×0.5 si el partido ya
  estaba resuelto ≥2 goles y ≥70')
→ Distribución NB sobre el restante (PHI: córners 1.30, tiros 1.45, SOT 1.25,
  TI 1.40, GK 1.35, tarjetas 1.20) · TARJETAS con HAZARD temporal
  (15'→9%, 45'→38%, 75'→73%; nivel = acum/H(min), no extrapolación)
→ MARKET ENGINE unificado: implícita (sin vig con ambas cuotas), edge,
  EV = p×cuota−1, umbral dinámico (4pp base + castigos), CONF_MIN 60,
  ABSTENTION ENGINE (razones duras → NO BET aunque haya edge; activa:
  mercado de tarjetas con roja en cancha — los DEMÁS mercados siguen
  operando con su ajuste estructural), señal = PAPER BET / NO BET,
  calidad A/B/C heurística
→ Opportunity Ranking por partido + aviso de correlación + AUDIT LOG
  (con registrarCierre() para CLV manual)
```

## 4. Combinadas (corregido tras la revisión)

- Implícita del target = **1/cuota** (1.50 → 66.7%).
- **P conjunta ≠ producto**: MATCH TEMPO latente de 3 estados (multiplicadores 0.88/1.00/1.12, pesos 0.25/0.50/0.25 — HEURÍSTICO declarado) que escala los expecteds de los mercados sensibles al ritmo (tiros/SOT/córners/goles/tarjetas; TI/GK insensibles). Picks condicionalmente independientes dado el tempo. **Marginales y conjunta salen del MISMO modelo** → el ajuste por dependencia es covarianza pura (verificado: 2 OVERs → +, OVER+UNDER → −).
- El par se elige por **mejor EV conjunto al target** (pair-level), no los dos mejores individuales. Independencia visible solo como benchmark. Umbral EV conjunto +2% provisional.

## 5. Validación (instrumentos listos, datos acumulándose)

- Live-logs por minuto sin futuro, con baseline prematch y **proyección naive (lineal) por snapshot** → el resumen muestra MAE modelo vs MAE naive por tramo (si no gana al naive, la complejidad es decorativa) + MAE del baseline prematch.
- **Calibración por bucket de probabilidad** (50-60...90-100 → % ocurrido), con advertencia de no-independencia entre snapshots del mismo partido (n efectivo ≈ partidos).
- Partidos con roja marcados aparte (análisis de error por régimen).
- Regla anti-overfitting: NO calibrar con <50 partidos/mercado, y por FASES (1 distribución → 2 PHI → 3 K → 4 estado → 5 calibración de probabilidades → 6 umbrales). Kelly prohibido hasta calibrar.

## 6. Qué se implementó de la revisión anterior (v1 → v2)

✅ Modo PAPER global · ✅ elegibilidad ≠ confianza (CONF_MIN 60) · ✅ Abstention Engine · ✅ corrección de la implícita de combinadas · ✅ tempo latente + P conjunta coherente + selección pair-level por EV conjunto · ✅ benchmarks naive por snapshot · ✅ calibration buckets · ✅ roja con contexto (estructura f(score, minuto) con fallback fijo) · ✅ CLV manual (registrarCierre) · ✅ marcado explícito HEURÍSTICO/BASELINE en código y UI.

**Pendiente (aceptado, esperando datos o decisión):** hazard córners/tiros como experimento vs baseline · descomposición del árbitro (faltas señaladas × tarjetas/falta — sin fuente) · w live dependiente de eventos (features ya se guardan en snapshots) · backend centralizado (PC+laptop) · odds feed (key de The Odds API) · comparación A/B/C de drivers de GK (posesión vs tiros desviados, necesita muestra) · walk-forward (necesita histórico).

## 7. Parámetros heurísticos (lista completa — NINGUNO aprendido de datos)

K (26-38) · PHI (1.20-1.45) · curva hazard tarjetas · Situation S y exponentes (^0.5-^0.8) · clamps de régimen/presión/estado · roja (0.80/1.08/1.12/0.92, atenuación 0.5) · árbitro (÷4.2, 0.80-1.25) · umbral 4pp + castigos · calidad A/B/C · tempo latente (±12%, 25/50/25) · EV conjunto mínimo 2% · mezclas 60/40 y 50/50 · shares SOT 0.34 / bloqueados 0.17.

## 8. Nuevas preguntas para el revisor

1. El tempo latente de 3 estados con ±12%: ¿qué protocolo usarías para estimar la magnitud y los pesos con los primeros ~50 partidos (que registran trayectorias completas por minuto de tiros/córners/tarjetas de ambos lados)?
2. La abstención por roja aplica solo al mercado de tarjetas; los demás usan el factor estructural. ¿Extenderías la abstención a otros mercados, o el factor con contexto es suficiente mientras se acumulan partidos con roja?
3. Para la calibración por buckets con snapshots dependientes: ¿agrupar por partido (un punto por partido/tramo) o cluster-robust? ¿Qué es práctico con n≈50?
4. ¿Cómo priorizarías las FASES 1-6 si a los 50 partidos el modelo NO le gana al naive en algún mercado — se elimina el mercado o se simplifica primero?
5. ¿El EV conjunto mínimo (+2% al target) es razonable como provisional, o debería escalar con la incertidumbre del tempo?
6. ¿Algo del roadmap pendiente (§6) que subirías o bajarías de prioridad?
