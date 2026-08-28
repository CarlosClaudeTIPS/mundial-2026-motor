# Modelo cuantitativo de Tiros LIVE

**Principio**: Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
NO BET válido y frecuente. Código: `src/lib/shots.js` · UI: `src/components/ShotsQuant.jsx` (pestaña En Vivo).

## 1. Definición y coherencia (§16)

Live-Score reporta por equipo, en vivo e histórico: "Total Shots", "Shots on Goal", "Blocked Shots" (categorías excluyentes: Total = OnGoal + OffGoal + Blocked). **Arquitectura de coherencia**: el TOTAL por equipo es el conteo principal; a puerta y bloqueados se anclan a sus acumulados reales + proporción del resto, y "fuera" es el **residuo exacto** → las categorías siempre suman el total, nunca 15+10+12=25.

## 2. Interacción, no promedios (§6)

- **Volumen por lado**: 60% lo que A genera (Shot Generation) + 40% lo que B concede (Shot Prevention), con **split localía** mezclado al 30% cuando hay ≥3 partidos de muestra (aprendido de sus datos, no ajuste fijo).
- **Proporciones por lado**: el % a puerta de A se mezcla 60/40 con el % a puerta que la defensa de B permite (mediana de sus últimos 10, clamps de plausibilidad 18-55% SOT, 5-35% bloqueado). En vivo, la proporción observada gana peso con el número de tiros (`w = tiros/(tiros+10)`).
- **Ancla empírica**: mediana de totales (shots + shotsAg) de los últimos partidos de ambos, 50/50 con la interacción.

## 3. Cantidad ≠ calidad (§9)

El xG/tiro de Sofascore se muestra como diagnóstico ("tira mucho de lejos") y aparece en los factores — **peso cero en el conteo**: un equipo de 20 tiros lejanos es volumen real para el mercado de tiros aunque su peligro sea bajo.

## 4. Live

Mezcla bayesiana `w = min/(min+26)` por lado; **Situation S^0.8 por marcador por lado** (evidencia fuerte: el que pierde patea — el spec lo pide como Match State §29); régimen reciente por lado (±15% ^0.5); presión por ataques peligrosos compartida (±12% ^0.5). **Dependencia entre equipos** (§34): el tempo compartido entra vía el factor DA común y el marcador acopla los dos lados en direcciones opuestas — no se asume independencia.

## 5. Distribución y mercados

Binomial Negativa: total `PHI = 1.45` (los tiros vienen en rachas de presión → clustering, §36), por equipo 1.35, SOT 1.25. **6 mercados** con selector: Tiros/SOT × Total/Local/Visitante, cada uno con escalera P(Over), edge y umbral propio (+1 pp por equipo, +2 pp si el SOT no tiene dato en vivo).

## 6. Variables SIN fuente → peso CERO

Zona/distancia/ángulo del tiro, tipo de finalización (cabeza/volea/balón parado), tiros por jugador, entradas al área, toques en área, pases progresivos, PPDA, transiciones, formación como coeficiente, tarjeta roja como escenario 11v10 dedicado. Alineaciones y clima: visibles en ContextoPartido, sin peso.

**Doble conteo evitado** (§44): drivers live = solo ataques peligrosos (correlación alta entre posesión/ataques/entradas al área → entraría la misma información tres veces). Posesión solo en el prior implícito de concesión del rival.

## 7. Live-backtest sin leakage

**Dos registros separados** (§37): `motor_shots_livelog_v1` (total tiros) y `motor_sot_livelog_v1` (a puerta), snapshots por minuto con solo lo disponible en ese momento, resueltos automáticamente con las stats finales de Live-Score. MAE/acierto/Brier por tramo, cada uno en su tabla. Constantes recalibrables en `SHOTS_MODEL` con ≥20 partidos resueltos.
