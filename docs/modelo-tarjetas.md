# Modelo cuantitativo de Tarjetas LIVE

**Principio**: Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
NO BET válido y frecuente. Código: `src/lib/cards.js` · UI: `src/components/CardsQuant.jsx` (pestaña En Vivo).
Sigue la arquitectura global PREMATCH/LIVE (`docs/arquitectura-prematch-live.md`): prior → baseline congelado → live sobre Match State Engine → dos edges.

## 1. Definición (§1)

"Yellow Cards" + "Red Cards" de Live-Score por equipo (jugadores; cuerpo técnico no siempre entra → ±1 posible vs bookie). Total del mercado = Y+R del proveedor. **Verificar la regla de segunda amarilla de tu casa** (algunas cuentan 2, otras 3 puntos en "booking points" — este módulo cuenta tarjetas, no puntos).

## 2. Prior prepartido (por equipo + árbitro)

- **Cadena causal** (§5): faltas esperadas del cruce (`calcExpectedFouls`, interacción 60/40) × tasa `cardsPerFoul` PROPIA de cada equipo, mezclado 50/50 con su promedio directo — no "más faltas = más tarjetas proporcional".
- **Disciplina propia ≠ provocada** (§3): tarjetas de A = 60% su historial + 40% lo que B **provoca** en sus rivales (mediana de `cardsAg` de B).
- **Árbitro real** (§11): amarillas/partido de Sofascore (`fetchSofaContexto`), factor `refYpg/4.2` acotado 0.80–1.25 sobre el total. Sin dato → factor 1 y la **confianza baja** (variable de alto impacto ausente, se declara). La interacción fina árbitro×equipos (§13) no tiene fuente → factor global, recalibrable.
- Ancla empírica: mediana de totales (cards+cardsAg) 60/40 con la interacción.

## 3. HAZARD temporal — el corazón del live (§17, §26)

Las tarjetas NO caen uniformes. Curva de intensidad acumulada H(min) piecewise (15'→9%, 30'→21%, 45+añadido→38%, 60'→53%, 75'→73%, final→100%). El live estima el **nivel** del partido: `totalEst = w·(acum/H) + (1−w)·prior`, con `w = min/(min+38)` (K alta: ~5 tarjetas/partido → el conteo observado es ruidoso mucho rato). Restante = `totalEst × (1−H) × estado × fricción × régimen`. Resultado verificado: 3 tarjetas al 38' proyectan 8.9, no el 7.5 lineal — el tramo final es el cargado.

## 4. Drivers live (sin doble conteo, §35)

- **Fricción**: faltas/min observadas vs esperadas del cruce (clamp ±12%, ^0.5) — el único driver causal externo (duelos/tackles/PPDA sin fuente).
- **Estado por lado** (§16): perdedor ×1.05; cerrado tarde (≤1 gol, ≥65') ×1.10; resuelto tarde ×0.94. Clamp 0.90–1.18.
- **Régimen**: ritmo reciente de tarjetas (ventana 10', Match State Engine).
- **Roja** (§21): NO es una amarilla más — sube el umbral de apuesta +1pp, baja la confianza −5, aparece en factores, y el partido queda marcado `hayRoja` en el registro. El recálculo estructural de los DEMÁS mercados (tiros/córners/GK) ya lo hace match-state.js.

## 5. Amonestados y próxima tarjeta

- **Amonestados** (§19): `fetchSofaAmonestados` (incidentes Sofascore, refresco ~5') → nombres, minuto y equipo en el panel. **Riesgo de segunda amarilla CUALITATIVO — peso cero en el número** (sin posición/faltas-post-amarilla no hay base para un coeficiente).
- **Próxima tarjeta** (§28, §46): carrera de Poisson entre las tasas actuales por lado → P(local), P(visitante), P(ninguna en 10'). Modelo temporal simple e independiente del total, declarado como tal.

## 6. Distribución, mercados y decisión

NB con `PHI = 1.20` total / 1.15 por equipo. Mercados: **total / local / visitante** con escalera, edge (vig removido con ambas cuotas) y umbral propio: base 4pp, +2 confianza<65, **+2 antes del 25'** (las tarjetas señalizan tarde), +1.5 por equipo, +1 con roja. Señal BET solo con confianza ≥50 y minuto ≥15. Baseline prematch congelado → franja Prematch→Live + edge prematch separado.

## 7. Sin fuente → peso CERO

Tipo de falta, zona del campo, duelos/tackles, transiciones, VAR, posición del amonestado, perfil disciplinario por jugador, rivalidad/derbi, importancia del partido. Documentado; entran solo si alguna fuente futura los trae Y el backtest los valida.

## 8. Live-backtest

`motor_cards_livelog_v1`: snapshots por minuto sin futuro, baseline prematch guardado, partidos con roja marcados. Resolución automática con Y+R finales de Live-Score. MAE/acierto/Brier por tramo + MAE prematch. Recalibrables: K, PHI, curva HAZARD, factor árbitro, clamps de estado.
