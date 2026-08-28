# Auditoría del sistema cuantitativo — respuestas al §66 del spec maestro

Fecha: 2026-08-28. Honesta: distingue lo IMPLEMENTADO de lo PENDIENTE y lo EXPERIMENTAL.

## Estado por fase del spec maestro (§65)

| Fase | Estado |
|---|---|
| 1 Auditoría | ✅ este documento |
| 2 Data Engine / BD histórica | ⚠️ parcial: localStorage con TTL y timestamps (baselines, live-logs por minuto, audit log, caches). NO hay BD de timeline minuto-a-minuto de TODOS los partidos — solo de los analizados en vivo. Una BD real necesita backend (Supabase, pendiente de decisión del usuario) |
| 3 Prematch/Live | ✅ real (arquitectura-prematch-live.md) |
| 4 Match State Engine | ✅ match-state.js |
| 5 Modelos por equipo + Matchup | ✅ interacción 60/40 generación×concesión en los 6 mercados; estilos por centros; splits localía en tiros |
| 6 Predicción/Distribución | ✅ NB con PHI por mercado, intervalos, escaleras |
| 7 Market/Edge/EV Engine | ✅ market-engine.js (unificado hoy) |
| 8 Correlation Engine | ⚠️ básico: grupos causales declarados + aviso de exposición conjunta. SIN matriz numérica (necesita histórico) |
| 9 Backtesting/Calibración | ⚠️ infraestructura completa (logs por minuto sin leakage, MAE/Brier/acierto por tramo, prematch vs live); FALTAN datos acumulados para calibrar |
| 10 Bankroll/CLV/Ranking | ⚠️ Bankroll ya existía (reglas $25k/4 al día/bloqueos); Ranking ✅ (Oportunidades); CLV ❌ (necesita cuotas de cierre — sin fuente para mercados de saques) |
| 11 Dashboard/Alertas | ⚠️ parcial: Oportunidades por partido + Rendimiento global; sin alertas push |

## Las 24 preguntas (§66)

1. **Mercados implementados**: córners, tiros, SOT, tiros fuera/bloqueados (derivados coherentes), tarjetas, saques de banda, saques de portería — cuant completos live. Goles/BTTS/hándicap: prematch en Analizar (motor v2), sin módulo cuant live. Faltas/offsides/porteros/próximo gol: NO implementados.
2. **Prematch**: todos los cuant (prior desde buildTeamStats) + Analizar completo.
3. **Live**: los 6 cuant + los recomendados clásicos de EnVivo.
4. **Variables por modelo**: documentadas en docs/modelo-*.md con fuente/evidencia/peso; lo sin fuente declarado peso cero.
5. **Compartidas**: minuto/restante/régimen/presión DA/rojas/marcador → match-state.js (única fuente). Priors → buildTeamStats. Decisión → market-engine.js.
6. **Duplicadas**: eliminadas en la refactorización (antes: restante ×4, régimen ×4, DA ×3, edge ×5 — hoy cero).
7. **Data leakage**: no detectado. Priors solo partidos terminados (+excludeFixtureId); snapshots guardan solo lo disponible en su minuto; baselines congelados.
8. **Fuentes**: Live-Score (conteos por equipo live+históricos; GK siempre null, TI solo recientes), Sofascore (TI/GK/centros/xG/árbitro/alineaciones/incidentes — solo navegador), Open-Meteo (clima). Definiciones y diferencias en cada doc.
9. **Distribuciones**: Binomial Negativa sobre el restante, PHI por mercado (1.20–1.45); tarjetas con hazard temporal; prematch NB con phi = var/media del prior.
10. **Probabilidades**: P(Over) = cola NB; escaleras alrededor del expected; por equipo con PHI propio.
11. **Edge**: p_modelo − p_implícita (sin vig si hay ambas cuotas), umbral dinámico 4pp + castigos declarados.
12. **EV**: p_lado × cuota_lado − 1 (market-engine). Distinto del edge y mostrado aparte.
13. **Calibración**: instrumento listo (Brier por tramo en cada live-log); SIN ejecutar aún — necesita ~20 partidos resueltos por mercado. Las probabilidades hoy NO están calibradas contra datos propios: tratarlas como estimaciones de modelo, no verdades.
14. **Backtesting**: live-logs por minuto autoresueltos + backtest prematch de Predicciones (top-5, diagnóstico de sesgo) + Rendimiento (error por mercado).
15. **CLV**: ❌ no medible — no hay fuente de cuotas de cierre para estos mercados. El audit log guarda cuota de entrada; si el usuario registra la de cierre a mano, se podrá calcular.
16. **Correlación**: grupos causales (tempo: córners/tiros/SOT/tarjetas/goles · pausas: TI/GK) con aviso de exposición conjunta. Matriz numérica pendiente de histórico.
17. **Stake**: reglas fijas del Bankroll ($25k máx, 4/día, bloqueos por pérdidas). Kelly NO implementado — y no debe implementarse hasta que la calibración demuestre que las probabilidades son fiables (Kelly con probabilidades mal calibradas quiebra).
18. **NO BET cuando**: edge < umbral dinámico, confianza <50, minuto < mínimo del mercado, o sin línea/cuota ingresada. Es la salida por defecto.
19-20. **Mejor/peor mercado**: SIN DATOS aún — lo responderá el live-backtest. Hipótesis a verificar: córners/tiros mejor (dato directo por equipo), GK peor (fuente alterna + definición).
21. **Dónde falla**: sin dato TI/GK en vivo (frecuente en LS), árbitro ausente, prórrogas, partidos con roja (factores sin validar), trial de API agotado, Sofascore con definición ±1-2 vs bookie.
22-23. **Variables que aportan/eliminar**: lo decide el backtest por tramo. Candidatos a eliminación ya señalados: factor marcador en TI (±6%, evidencia débil), clima (peso cero actual), factor bloqueados en córners.
24. **Experimental** (sin validación fuera de muestra): factores de roja (×0.80/×1.08), curva HAZARD de tarjetas, factor árbitro, calidad A/B/C, todos los PHI y K. Todo constante exportada y recalibrable.

## Regla de oro vigente

Ningún módulo se considera "terminado": funciona técnicamente y su metodología está documentada, pero **el rendimiento fuera de muestra está por demostrarse** con los registros que se están acumulando. Cuando cada log llegue a ~20 partidos: pedir "recalibra los módulos".
