# SISTEMA CUANTITATIVO DE APUESTAS DE FÚTBOL — Documento maestro v4

> Para revisión externa. Rondas previas: v1→refactor metodológico (PAPER, Match State, baselines), v2→v3 (MC, tests, métricas, roja por mercado), v3→v4 (esta). Describe el sistema DESPUÉS de implementar tu auditoría v4.

## 1. Contexto

App web client-side (Vite+React, localStorage) para un tipster individual (Colombia). ~28 ligas, PREMATCH y LIVE. Mercados cuant: córners, tiros, SOT, tarjetas, TI, GK. Líneas/cuotas manuales. Meta: combinadas 2 picks ≥1.50. **MODO PAPER global** (señal positiva = PAPER BET). **25 tests unitarios** protegen las invariantes. Ningún parámetro ajustado a datos propios — todos heurísticos declarados.

## 2. Fuentes

Live-Score (trial): conteos por equipo live+históricos; GK null, TI solo recientes. Sofascore (solo navegador, enrichment con castigo de confianza): TI/GK/xG/árbitro/alineaciones/amonestados. Open-Meteo: display. Sin fuente (peso cero): PPDA, zonas, jugadores, cuotas de cierre automáticas.

## 3. Pipeline (tras v4)

```
buildTeamStats (solo terminados, medianas filtradas, 30/70, ajuste división)
→ PRIOR (interacción 60/40 + ancla empírica; árbitro real en tarjetas)
→ BASELINE congelado → LIVE w=min/(min+K) [K 26-38, BASELINE declarado]
→ MATCH STATE ENGINE (restante, régimen ±15%^0.5, presión DA ±12%^0.5,
  roja ×0.80/×1.08 con atenuación contextual, GK inverso)
→ NB restante (PHI 1.20-1.45) · tarjetas con hazard temporal
→ MARKET ENGINE (implícita sin vig, edge, EV, umbral 4pp+castigos, CONF_MIN 60,
  ABSTENTION, PAPER BET/NO BET, calidad A/B/C heurística)
→ RED CARD REGIME por mercado (tarjetas abstención dura pero sigue prediciendo;
  córners/tiros/GK +2pp y −5 conf; cada roja registra minuto y marcador)
→ SAMPLE-SIZE GATING (v4 §9): estadoPorMuestra(n) por mercado con n de
  partidos RESUELTOS visible en cada panel (INSUFFICIENT_DATA <10 → BASELINE;
  EXPERIMENTAL/CALIBRATED/DISABLED = promoción manual con criterios §24-25)
→ Ranking + correlación + AUDIT LOG + registrarCierre() (CLV manual)
```

## 4. Combinadas (tras v4 — correcciones implementadas)

- **COHERENCIA NB (tu prioridad 1)**: `pPickDadoTempo` usa **NB con el PHI de cada mercado** (`PHI_CAT`: shots 1.45, sot 1.25, corners 1.30, cards 1.20, goals 1.10, ti 1.40, gk 1.35) — ya no Poisson. El MC muestrea NB vía **Gamma-Poisson** (Marsaglia-Tsang). Tests: para mercados insensibles al tempo, la marginal del proceso conjunto = NB individual EXACTA (±0.1pp); MC ≈ analítico ±2pp; cotas de Fréchet.
- **Nota residual declarada**: en mercados SENSIBLES al tempo, la marginal de la mixtura tiene levemente más dispersión que la NB plana del panel individual. Coherencia total exigiría que los paneles usen la mixtura — decisión pospuesta a la validación del tempo (diferencia pequeña, dirección conservadora). ¿Opinión?
- **TEMPO_SENS por mercado** (tu §6): estructura de sensibilidad individual (hoy binaria 1/0 heurística: shots/sot/corners/goals/cards=1, ti/gk=0); la respuesta observada por mercado se podrá estimar con los registros.
- **EV probabilístico (tu §7-8)**: peor-caso degradado a diagnóstico (`evPeor`); criterio = **EV esperado > +2% Y P(EV>0) ≥ 70%**, con `evP10/evP90` visibles. Tempo baseline 0.88/1.00/1.12, 25/50/25 sin calibrar (declarado).
- Implícita target = 1/cuota; selección pair-level por EV conjunto; independencia solo benchmark.

## 5. Validación (instrumentos completos)

Por mercado: MAE modelo vs **naive lineal** vs baseline prematch por tramo · calibración por bucket (unidad-partido advertida) · log-loss · sharpness · **cobertura + ancho + interval score (α=0.2)** — el intervalo ancho ya no se premia · **CRPS** de la distribución completa (`crpsNB` por snapshot, mu guardado) · partidos con roja marcados (minuto y marcador) · **finales por lado** guardados en los 6 registros (materia prima de dependencia residual, tu §15 — el residual condicionado por lado queda pendiente porque los snapshots no guardan proyección por lado). Protocolo n=50 aceptado: diferencia de loss POR PARTIDO, media/mediana/bootstrap/proporción, no p-value como criterio único.

## 6. Qué se implementó de tu v4

✅ P1 coherencia NB individual/combinadas + MC Gamma-Poisson + tests · ✅ P2 sample-size gating con n visible · ✅ P3 CRPS + interval score + width · ✅ P4 EV probabilístico (P(EV>0), P10/P90; peor-caso→diagnóstico) · ✅ P5 finales por lado (residuales: parcial declarado) · ✅ tempo_sensitivity por mercado (estructura) · ✅ tests 20→25 · ✅ tu advertencia sobre el hito 500→hazard registrada: NO es automático.

**Pendiente aceptado (espera datos/decisión):** market-aware A/B/C · walk-forward · tempo continuo (β) · Diebold-Mariano/bootstrap (protocolo escrito) · dashboard §23 completo · residual condicionado por lado · cópulas · CRPS ponderado · backend · Kelly.

## 7. Heurísticos (ninguno aprendido)

K 26-38 · PHI 1.20-1.45 (= PHI_CAT en combinadas) · hazard tarjetas · Situation S ^0.5-0.8 · clamps · roja 0.80/1.08/1.12/0.92 + atenuación · árbitro ÷4.2 · umbral 4pp + castigos · calidad A/B/C · tempo ±12% 25/50/25 y TEMPO_SENS binaria · EV floor +2% / P(EV>0) ≥70% · mezclas 60/40, 50/50 · shares 0.34/0.17 · gating <10/<50.

## 8. Plan por hitos

50 → diagnóstico FASE 1 (¿NB > naive por partido? sesgo, cobertura, sharpness, CRPS) · 100 → PHI + candidatos a DISABLED (simplificar antes de eliminar) · 250 → K, estado, magnitud/sensibilidad del tempo · 500 → hazard córners/tiros SOLO SI a 250 el baseline no basta; walk-forward · 1000 → dependencia residual, market-aware, umbrales por mercado.

## 9. Preguntas para esta ronda

1. La nota residual del §4: ¿aceptable dejar la NB plana en paneles individuales y la mixtura-NB en combinadas hasta validar el tempo, o unificarías YA los paneles a la mixtura (costo: los P(Over) individuales bajan/suben ~1pp y el usuario ve números levemente distintos entre panel y combinada)?
2. P(EV>0) con 3 estados discretos solo puede valer 0/25/50/75/100% — ¿umbral 70% razonable en esa granularidad, o recomendarías interpolar/añadir estados SOLO para el cálculo del EV?
3. El gating usa n de partidos RESUELTOS del registro live local. ¿Añadirías un gate separado por régimen (n con roja, n por liga) desde ya, o eso fragmenta demasiado con muestras chicas?
4. CRPS implementado sobre la distribución del TOTAL final en cada snapshot. ¿Lo reportarías también por tramo de minuto (como el MAE) o el agregado basta para FASE 1?
5. ¿Qué te parece el criterio de promoción manual EXPERIMENTAL→CALIBRATED tal como quedó (muestra + benchmark + calibración + estabilidad + calidad, decisión documentada) — falta algo operativo?
6. ¿Riesgos nuevos introducidos por v4 que veas?
