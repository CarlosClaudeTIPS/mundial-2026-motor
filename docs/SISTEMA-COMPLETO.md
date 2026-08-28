# SISTEMA CUANTITATIVO DE APUESTAS DE FÚTBOL — Documento maestro v3

> Para revisión externa. v1 fue auditada (→ refactor metodológico), v2 fue auditada (→ esta ronda). Este documento describe el sistema DESPUÉS de implementar la segunda auditoría. Secciones: contexto → fuentes → pipeline → combinadas → validación → **qué se implementó de tu auditoría v2→v3** → heurísticos → plan por hitos → preguntas nuevas.

## 1. Contexto

App web (Vite + React, client-side, localStorage) para un tipster individual (Colombia). Fútbol PREMATCH y LIVE, ~28 ligas. Mercados cuant: **córners, tiros, SOT, tarjetas, TI, GK**. Líneas/cuotas manuales. Meta: combinadas de 2 picks ≥1.50. Bankroll fijo ($25k COP máx, 4/día, bloqueos).

**MODO PAPER global**: toda señal positiva = PAPER BET. Ningún parámetro ajustado a datos propios; todos declarados heurísticos. **20 tests unitarios (vitest) protegen las invariantes** — distribución válida, coherencia contable, coherencia conjunta/marginales, decisión, roja, hazard, anti-leakage.

## 2. Fuentes (limitaciones reales)

Live-Score API (trial): conteos por equipo live+histórico (tiros/SOT/bloqueados/córners/tarjetas/faltas/posesión/DA); GK null, TI solo recientes, 1500 calls/día. Sofascore (solo navegador, semi-oficial): TI/GK/centros/xG, árbitro (am/partido), alineaciones, amonestados, cuotas 1X2 — tratado como enriquecimiento con castigo de confianza. Open-Meteo: clima display-only. SIN FUENTE (peso cero): PPDA, zonas, duelos, jugadores, cuotas de cierre automáticas (The Odds API pendiente de key).

## 3. Pipeline

```
buildTeamStats (solo partidos TERMINADOS; medianas con filtros; 30/70 últimos 5/10;
  ajuste división; relleno Sofascore) 
→ PRIOR por mercado (interacción 60% genera / 40% concede, ancla empírica 50/50;
  splits localía en tiros; árbitro real en tarjetas ÷4.2 clamp 0.80-1.25)
→ PREMATCH BASELINE congelado (nunca se pisa)
→ LIVE: w = min/(min+K) [K 26-38 por mercado — BASELINE declarado; features para
  w = f(eventos, calidad, estabilidad) ya se guardan en snapshots]
→ MATCH STATE ENGINE: restante efectivo, régimen (±15% ^0.5), presión DA (±12% ^0.5),
  ROJA estructural (×0.80/×1.08, GK inverso, atenuada ×0.5 si partido resuelto)
→ NB restante (PHI 1.20-1.45) · TARJETAS con hazard temporal (nivel = acum/H(min))
→ MARKET ENGINE: implícita sin vig, edge, EV, umbral dinámico 4pp+castigos,
  CONF_MIN 60, ABSTENTION ENGINE, señal PAPER BET/NO BET, calidad A/B/C heurística
→ RED CARD REGIME POR MERCADO (v3 §25): tarjetas = abstención dura (el modelo
  SIGUE prediciendo, solo se silencia la señal); córners/tiros/GK = +2pp umbral
  y −5 confianza sin bloquear; TI sin efecto (sin modelo de roja).
  Cada roja registra minuto y marcador (rojaMin/rojaDiff) para estimación futura.
→ Opportunity Ranking + correlación + AUDIT LOG + registrarCierre() (CLV manual)
```

## 4. Combinadas (post v3)

- Implícita del target = 1/cuota (1.50 → 66.7%).
- **Proceso generativo ÚNICO**: tempo latente 3 estados (0.88/1.00/1.12, 25/50/25 — TEMPO BASELINE heurístico) escala expecteds de mercados sensibles (tiros/SOT/córners/goles/tarjetas; TI/GK insensibles); picks condicionalmente independientes dado el estado; marginales y conjunta de la MISMA mixtura.
- **Validador Monte Carlo** (`jointProbabilityMC`): muestrear estado → Poisson condicionado → evaluar A∩B; test automático confirma coincidencia con el analítico ±2pp (40k sims, rng determinista). Tests direccionales: OVER+OVER dep>0, OVER+UNDER dep<0, TI≈independiente.
- **EV conjunto con incertidumbre** (§22 tuyo): EV por estado de tempo → `EV ±unc`; el par se RECHAZA si el peor caso < −2% aunque el EV central sea positivo. Safety floor provisional: EV > +2% Y peor caso > −2%.
- Selección pair-level por mejor EV conjunto al target; independencia solo benchmark; "correlación" reservada al coeficiente de categorías, el ajuste se llama dependencia.

## 5. Validación (instrumentos completos; datos acumulándose)

Live-logs por minuto sin futuro, con: baseline prematch, **naive lineal por snapshot** (benchmark), intervalo 10-90 por snapshot. Summary por mercado: MAE modelo vs naive vs baseline prematch por tramo (5-20'...80-95') · **calibración por bucket de probabilidad** (50-60...90-100 → % real, advertencia de snapshots no independientes, n efectivo ≈ partidos) · **log-loss** (ref. 0.693) · **sharpness** (0 = siempre 50/50) · **cobertura del intervalo 10-90** (objetivo ~80%) · partidos con roja contados y marcados. Resolución automática con stats finales. Regla anti-overfitting: nada se calibra con n<50 y solo por fases.

## 6. Qué se implementó de tu auditoría v2→v3

✅ MC como método de referencia del proceso generativo + tests de coherencia (§16-17, §19, §44) · ✅ log-loss y sharpness y coverage (§6-7, §38 — CRPS pendiente, log-loss primero) · ✅ EV conjunto con incertidumbre, +2% degradado a safety floor provisional (§21-22) · ✅ red-card regime por mercado en vez de bloqueo único (§25) + registro minuto/marcador de roja (§26) · ✅ tempo etiquetado TEMPO BASELINE no aprendido (§11) · ✅ 20 tests unitarios (§44) · ✅ plan de calibración por hitos (§4, §45).

**Aceptado y pendiente de datos/decisión** (sin implementar, consciente): tempo continuo con β estimado (§13) · residuales por lado para dependencia residual (§14) · descomposición del árbitro (§29, sin fuente de faltas señaladas) · A/B/C GK y TI (§30-31, necesita muestra) · market-aware experiment (§33-34) · walk-forward (§10) · interfaz de persistencia PredictionStore/etc. (§43) · CRPS · sample-size gating formal por estado (§3 — hoy binario PAPER/no).

## 7. Heurísticos (completos, ninguno aprendido)

K 26-38 · PHI 1.20-1.45 · hazard tarjetas · Situation S ^0.5-0.8 · clamps régimen/presión/estado · roja 0.80/1.08/1.12/0.92 + atenuación 0.5 · árbitro ÷4.2 · umbral 4pp + castigos (+2 conf<65, +2 temprano, +1 sin under, +1-1.5 por equipo, +2 roja soft) · calidad A/B/C · tempo ±12% 25/50/25 · EV floor +2%/−2% · mezclas 60/40 y 50/50 · shares SOT 0.34 / blk 0.17.

## 8. Plan por hitos (partidos resueltos por mercado)

**50** → diagnóstico: ¿NB > naive? ¿sesgo? ¿cobertura ~80%? ¿sharpness útil? · **100** → PHI + marcar mercados DISABLED si pierden contra naive (simplificar antes de eliminar) · **250** → K, factores de estado, magnitud del tempo (¿existe efecto multi-mercado? ¿de qué tamaño?) · **500** → hazard córners/tiros experimental vs baseline, walk-forward · **1000** → dependencia residual entre lados, market-aware, umbrales por mercado.

## 9. Preguntas para esta ronda

1. El validador MC usa Poisson por mercado dentro de la mixtura (no NB) — el analítico de combinadas también es Poisson-mixtura, mientras los mercados individuales usan NB. ¿Es un problema de coherencia relevante entre el módulo de combinadas y los módulos individuales, o aceptable mientras el tempo-mixture ya induce sobredispersión marginal?
2. Para el diagnóstico a n=50: ¿qué umbral usarías para declarar "NB no supera al naive" con snapshots dependientes (¿test pareado por partido en el tramo 35-50'?)?
3. La incertidumbre del EV como rango entre estados de tempo, ¿es una cota razonable o recomendarías bootstrap sobre los parámetros del prior (medianas empíricas) que es implementable sin más datos?
4. El sample-size gating formal (§3 tuyo: BASELINE/EXPERIMENTAL/CALIBRATED/INSUFFICIENT_DATA/DISABLED por mercado): ¿lo priorizarías ya como estructura de código, o el flag global PAPER es suficiente hasta los primeros 50?
5. ¿Algo del backlog pendiente (§6) que subirías de prioridad AHORA que hay tests y métricas de distribución?
6. ¿Ves algún riesgo NUEVO introducido por los cambios v3 (p.ej. el rechazo por peor-caso del tempo puede ser demasiado conservador y matar todas las combinadas)?
