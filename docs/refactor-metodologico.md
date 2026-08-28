# Informe de refactorización metodológica (v2, v3 y v4)

## RONDA v4 (2026-08-28, tercera auditoría externa)

**Prioridad 1 — COHERENCIA NB (implementada):** las combinadas ya NO usan Poisson: `pPickDadoTempo` usa **NB con el PHI de cada mercado** (`PHI_CAT`), y el Monte Carlo muestrea NB vía mezcla **Gamma-Poisson** (Marsaglia-Tsang + Knuth/aprox normal). Test de coherencia: para mercados insensibles al tempo la marginal del proceso conjunto = NB individual EXACTA (±0.1pp); para sensibles, MC ≈ analítico ±2pp. **Nota residual honesta:** en mercados sensibles al tempo, la marginal de la mixtura tiene algo más de dispersión que la NB(μ,φ) plana que muestra el panel individual — coherencia total exigiría que los paneles también usaran la mixtura; pendiente de decidir cuando se valide el tempo (la diferencia es pequeña y en la dirección conservadora).
**Prioridad 2 — Sample-size gating (implementado):** `estadoPorMuestra(n)` por mercado (INSUFFICIENT_DATA <10, BASELINE, nota de hito a 50); cada panel muestra su estado y su n de partidos resueltos (`resolvedCount()` por log). EXPERIMENTAL/CALIBRATED/DISABLED son promociones manuales documentadas (v4 §24-25), no automáticas por n.
**Prioridad 3 — CRPS + interval score (implementados):** snapshots guardan `mu`; `crpsNB(mu, phi, acum, y)` evalúa la distribución completa por snapshot (test: CRPS menor cuando la distribución está centrada en el resultado). Interval score con α=0.2 + ancho medio del intervalo junto a la cobertura — un intervalo ancho ya no se premia.
**Prioridad 4 — EV probabilístico (implementado):** el peor-caso quedó SOLO como diagnóstico (`evPeor`); el criterio es **EV esperado > +2% Y P(EV>0) ≥ 70%**, con `evP10/evP90` mostrados. Corrige el rechazo excesivo que señalaste (estado de baja probabilidad con EV negativo ya no veta un EV esperado claramente positivo).
**Prioridad 5 — Residuales (parcial):** los resolvers guardan `finalH/finalA` por lado en los 6 registros — la materia prima para estudiar dependencia residual. El residual condicionado (vs predicción por lado por snapshot) queda pendiente porque los snapshots genéricos no guardan proyección por lado.
**Tempo por mercado (§6):** `TEMPO_SENS` por mercado (estructura lista; hoy binaria 1/0 heurística) — deja de ser un multiplicador idéntico implícito.
**Tests:** 20 → **25** (Fréchet bounds, coherencia NB marginal, EV probabilístico, CRPS, gating).
**Aceptado sin implementar (espera datos):** market-aware A/B/C, walk-forward, tempo continuo (β), Diebold-Mariano/bootstrap por partido (protocolo escrito para n=50), dashboard §23 completo, cópulas, backend, Kelly. **Y su advertencia queda registrada:** el hito "500 → hazard" NO es automático — si a 250 NB+tempo+calibración explica bien, la complejidad no se agrega.

---


## RONDA v3 (2026-08-28, tras la segunda auditoría externa) — informe §48

**1-2. Qué cambió / qué quedó igual:** arquitectura intacta; cambios: (a) **Monte Carlo validador** de las combinadas (`jointProbabilityMC`) — mismo proceso generativo (muestrear tempo → Poisson condicionado → evaluar A∩B); test automático confirma que marginales y conjunta coinciden con el analítico ±2pp → NO hay bug de coherencia (§16-17). (b) **Incertidumbre del EV conjunto**: EV por estado de tempo → EV ±unc; el par se rechaza si el peor caso cae < −2% aunque el EV central sea positivo (§22). (c) **Log-loss, sharpness y cobertura del intervalo 10-90** en todos los live-logs (§6-7, §38). (d) **Red Card Regime por mercado** (§25): tarjetas = abstención dura (el modelo SIGUE prediciendo, solo se silencia la señal); córners/tiros/GK = +2pp umbral y −5 confianza, sin bloquear; TI sin efecto (sin modelo de roja). (e) **Registro de rojas** para estimación futura: minuto y marcador al momento de la roja en cada log (§26). (f) **20 tests unitarios** (vitest, `npm test`): distribución válida y monótona, coherencia contable de tiros, dependencia +/− según dirección, independencia de TI vs tempo, MC vs analítico, PAPER BET, abstención, vig, factores de roja coherentes e inversos en GK, atenuación contextual, hazard creciente y concentrado al final, restante ≥0 (§44).
**3. Heurísticos:** los mismos de la lista §7 del doc maestro + tempo (±12%, 25/50/25) — NINGUNO recalibrado (regla n<50 respetada).
**4-6. Estados:** todos BASELINE; experimentales: tempo latente, atenuación de roja, MC; calibrados: ninguno.
**7-18. Benchmarks/calibración/CLV:** instrumentos completos (naive por snapshot, calib buckets, log-loss/sharpness/coverage, registrarCierre) — NOT ENOUGH DATA para conclusiones.
**19-20. PAPER/DISABLED:** todos los mercados siguen en PAPER; ninguno DISABLED aún (se decidirá contra el naive con muestra).
**21. Información más valiosa:** cuotas reales (key The Odds API pendiente) y más partidos analizados.
**22. Plan por hitos:** 50 partidos/mercado → diagnóstico (¿NB > naive? ¿sesgo? ¿cobertura ~80%?); 100 → PHI + decisión de mercados DISABLED; 250 → K, factores de estado, tempo (magnitud); 500 → hazard córners/tiros experimental vs baseline, walk-forward; 1000 → dependencia residual entre lados, market-aware, umbrales por mercado.
**Pendiente aceptado sin implementar** (espera datos o decisión): tempo continuo (β estimado), descomposición del árbitro, w live por eventos (features ya guardados), A/B/C de GK y TI, market-aware, walk-forward, interfaz de persistencia para backend, CRPS completo (log-loss como primer paso).

---

# Informe v2 (primera auditoría)

Fecha: 2026-08-28. Implementa las prioridades de la auditoría externa SIN destruir la arquitectura.

## A. Arquitectura anterior
6 mercados cuant (córners/tiros/SOT/tarjetas/TI/GK) con prior→live bayesiano, NB, Match State Engine, baselines congelados, market engine unificado, live-logs por minuto. Ver docs/SISTEMA-COMPLETO.md.

## B. Problemas encontrados (confirmados por la revisión)
1. Heurísticas presentadas como si fueran probabilidades validadas. 2. Combinadas con producto de probabilidades (independencia falsa) y criterio de cuota MAL calculado (1.025/1.50=68.3% en vez de 1/1.50=66.7%). 3. Confianza ≥50 habilitaba señal (demasiado permisivo). 4. Sin benchmarks naive. 5. Sin curvas de calibración. 6. Sin abstención explícita. 7. Roja con factor fijo sin contexto. 8. Sin CLV.

## C. Cambios realizados
- **MODO PAPER global** (`CALIBRACION='sin-calibrar'` en market-engine): toda señal positiva es ahora **📝 PAPER BET** — registrar y seguir, no ventaja demostrada. El botón BET real solo existirá cuando la calibración lo respalde. Badge en cada panel: "Modelo BASELINE (heurístico, sin calibrar)".
- **Elegibilidad ≠ confianza**: CONF_MIN subida 50→60; ABSTENTION ENGINE en evaluarMercado (`abstenciones: [{cond, why}]`) → NO BET con razón explícita aunque haya edge. Primera abstención activa: tarjetas con roja en cancha ("el modelo no está validado para ese régimen").
- **Combinadas corregidas**: `jointProbability` con MATCH TEMPO latente de 3 estados (0.88/1.00/1.12, pesos 25/50/25 — HEURÍSTICO declarado); marginales y conjunta del MISMO modelo → el ajuste es covarianza pura (verificado: dos OVERs +1.3pp, OVER+UNDER −1.3pp). Implícita del target = 1/cuota (corregido). `suggestCombo` elige el par por MEJOR EV CONJUNTO al target 1.50 (pair-level, no los 2 mejores individuales). Independencia queda SOLO como benchmark visible.
- **Benchmarks naive** (§20): cada snapshot del live-log guarda también la extrapolación lineal; el resumen muestra MAE modelo vs MAE naive por tramo — si el modelo no gana, la complejidad es decorativa y se verá.
- **Calibración por bucket** (§19): el resumen agrupa por probabilidad dicha (50-60...90-100) → % ocurrido, con la advertencia de que snapshots del mismo partido no son independientes (n efectivo ≈ partidos).
- **Roja con contexto** (§17): `redCardFactor(own, rival, ctx)` — estructura para el reemplazo dinámico; hoy solo atenúa (×0.5 del efecto) cuando la roja llega con partido ya resuelto (≥2 goles, ≥70'). Baseline fijo como fallback declarado.
- **CLV** (§31): `registrarCierre(matchId, market, line, closingOdds)` sobre el audit log — registro manual habilitado; sin conclusiones hasta tener muestra.

## D. Parámetros TODAVÍA heurísticos (lista completa, sin excepción)
K por mercado (26-38) · PHI por mercado (1.20-1.45) · curva HAZARD tarjetas · Situation S y suavizados (^0.5-^0.8) · clamps de régimen/presión/estado · factores de roja (0.80/1.08/1.12/0.92 + atenuación 0.5) · factor árbitro (÷4.2, 0.80-1.25) · umbral 4pp + castigos · calidad A/B/C · tempo latente (±12%, 25/50/25) · EV conjunto mínimo +2% · mezclas 60/40 y 50/50 de los priors · shares SOT/bloqueados por defecto.

## E. Parámetros aprendidos de datos propios
**NINGUNO todavía.** (Los únicos insumos empíricos son las medianas/desviaciones de los últimos 10-14 partidos de cada equipo, que son datos, no parámetros ajustados.)

## F. Modelos experimentales
Tempo latente para conjuntas · atenuación contextual de roja · hazard córners/tiros (NO implementado — pendiente como experimento tras acumular datos).

## G. Modelos calibrados
**NINGUNO.** Estado global: todos BASELINE (MODEL_STATUS en market-engine).

## H. Datos necesarios para mejorar
Por mercado ≥50-100 partidos resueltos con snapshots (no 20 — la revisión tiene razón: trayectorias del mismo partido no son observaciones independientes). Para córners/tiros: series por minuto para evaluar hazard. Para árbitro: faltas señaladas + tarjetas/falta (sin fuente aún). Cuotas: key de The Odds API (pendiente del usuario) para CLV automático en córners/tarjetas.

## I. Benchmarks — J. Overfitting — K. Leakage
Naive lineal ya registrado por snapshot; prematch-sin-actualizar ya comparado (baseline MAE). Overfitting: mitigado por la regla "no calibrar 25 parámetros con 20 partidos" — la calibración seguirá las FASES 1-6 del prompt (distribución → PHI → K → estado → probabilidades → umbral). Leakage: sin cambios (ya protegido); revision-leakage anotado como riesgo abierto (las stats históricas podrían ser corregidas por el proveedor — no reconstruimos predicciones pasadas, solo comparamos contra lo guardado en su momento, que es lo correcto).

## L-P. Calidad de datos / rendimiento / CLV
Sin cambios estructurales de fuentes (Sofascore sigue siendo enriquecimiento con castigo de confianza cuando es la única fuente). Rendimiento por mercado, prematch vs live, combinadas y CLV: **NOT ENOUGH DATA** — los instrumentos están, los números llegarán.

## Q. Recomendaciones siguientes (en orden)
1. Acumular: usar la app en modo PAPER en cada partido que veas — cada análisis alimenta los registros solo.
2. Al llegar ~50 partidos/mercado: FASE 1 (¿NB le gana a Poisson y al naive?) — nada más.
3. Conseguir key de The Odds API → CLV automático córners/tarjetas.
4. Decidir backend (Supabase) para unificar registros PC+laptop antes de confiar en históricos.
5. Solo después: hazard córners/tiros como experimento contra el baseline.
