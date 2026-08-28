# Arquitectura PREMATCH / LIVE — regla global del motor

Regla para TODO mercado (actual y futuro): **PREMATCH = prior congelado · LIVE = actualización bayesiana de ese prior**. Nunca dos modelos aislados, nunca un mercado solo-histórico ni solo-live.

```
PREMATCH DATA (solo partidos TERMINADOS) → PREMATCH ENGINE (prior por mercado)
  → PREMATCH BASELINE (congelado en localStorage, no se pisa)
    → LIVE EVENT STREAM (Live-Score/Sofascore cada 60s)
      → MATCH STATE ENGINE (match-state.js: estado único compartido)
        → LIVE UPDATE ENGINE (mezcla bayesiana w = min/(min+K) por mercado)
          → distribución NB → edge prematch + edge live → BET / NO BET
```

## Auditoría (§25) y dónde quedó cada cosa

1. **Prematch**: `buildTeamStats` (league-stats.js) — SOLO partidos terminados; `excludeFixtureId` protege el backtest. Los priors de los 4 módulos (`tiPrior`, `gkPrior`, `cornersPrior`, `shotsPrior`) consumen únicamente ese historial → son prepartido puro aunque se calculen con el partido empezado (por eso es válido congelarlos tarde).
2. **Live**: fetchFixtureStats/fetchSofaPartidoActual cada 60s → snapshots en `snapsRef` (EnVivo) con minuto.
3. **Disponibilidad por etapa**: prematch = historial + alineaciones/árbitro/clima (contexto, peso cero); live = acumulados por equipo + marcador + rojas + DA + bloqueados.
4. **Uso incorrecto detectado y corregido**: ninguno de leakage; sí había DUPLICACIÓN (restante efectivo ×4, régimen ×4, factor DA ×3, cada módulo por su lado) → violaba §10.
5. **Riesgo de leakage**: cero en priors; los live-logs guardan snapshots por minuto solo con lo disponible en ese momento (`makeLiveLog`).
6. **Separación por módulo**: los 4 ya eran prior→live bayesiano; lo que faltaba era baseline persistido + estado compartido + rojas + edge prematch.
7. **Match State Engine** (`src/lib/match-state.js`): `restanteEfectivo`, `regimeOf` (genérico por stat), `pressureFactor` (DA), `redCardFactor`/`redCardFactorGk`, `buildMatchState`. Los 4 módulos lo importan — una sola fuente de verdad.
8. **Timestamps**: baselines con `ts`; live-logs con `ts` + `min` por snapshot; caches Sofascore/clima con TTL.
9. **Backtesting temporal**: `makeLiveLog.summary()` → MAE/acierto/Brier por tramo (5-20'...80-95') + **comparación PREMATCH vs LIVE** (§14): MAE del baseline congelado vs MAE por tramo. Si el live no mejora el prematch conforme avanza, se ve de inmediato. Partidos con roja marcados (`conRoja`) para validar los factores estructurales.
10. **Actualización sin perder contexto**: el peso prematch/live NO es 50/50 fijo — es `w = min/(min+K)` (K=26-32 por mercado). El spec pide APRENDER esa transición: K es constante exportada y el live-backtest por tramo es exactamente el instrumento para recalibrarla con ≥20 partidos.

## Baseline prematch (`src/lib/baseline.js`)

`ensureBaseline(matchId, market, {expected, sd})` congela el prior la PRIMERA vez y nunca lo pisa (verificado). Distribución prematch: NB con phi efectivo = var/media (≥1.05). Mercados: `ti`, `gk`, `corners`, `shots`, `sot`. Con él cada panel muestra:
- **"Prematch → Live"**: baseline → expected actual con Δ% (§21).
- **Edge PREMATCH separado del edge LIVE** con la misma línea/cuota (§16-18): se puede ver "prematch decía NO BET y live dice BET" (§19 — correcto y esperado).
- El "por qué cambió" (§22) son los factores explicados (ritmo vs prior, régimen, marcador, presión, roja).

## Tarjeta roja — cambio estructural (§8, §34 de specs de mercado)

`RED_CARD` en match-state.js: el equipo con 10 genera ×0.80, su rival ×1.08 (córners y tiros, por lado); en GK es inverso (el de 10 saca ×1.12, el dominante ×0.92 → efecto neto en el total ≈ +2%). En TI: sin factor (efecto desconocido → peso cero). Magnitudes conservadoras basadas en el efecto 11v10 documentado en fútbol, **marcadas como recalibrables**: el registro guarda `hayRoja` por partido para ajustarlas o eliminarlas con datos propios.

## Regla para mercados futuros (§24)

Todo mercado nuevo (goles, faltas, offsides, xG...) debe entregar: prior desde `buildTeamStats` → `ensureBaseline` → modelo live que consuma `match-state.js` → NB → edge prematch + live → confianza → BET/NO BET → `makeLiveLog` con baseline. Prohibido: mercado solo-histórico, mercado solo-live, o recalcular estado por su cuenta.
