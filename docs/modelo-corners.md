# Modelo cuantitativo de Córners LIVE

**Principio**: Datos → Modelo → Probabilidad → Incertidumbre → Línea → Edge → Decisión.
NO BET válido y frecuente. Código: `src/lib/corners.js` · UI: `src/components/CornersQuant.jsx` (pestaña En Vivo).

## 1. Definición del evento (§1)

"Corner Kicks" de **Live-Score** = córners EJECUTADOS por cada equipo, disponible **en vivo por equipo** (el mejor dato del motor: fuente directa, sin fuentes mezcladas en un mismo partido). Sofascore coincide en definición (se usa solo para el prior histórico vía centros/estilo, nunca mezclado en el conteo live).

## 2. Arquitectura — por equipo, no solo total (§21)

Cada lado se modela por separado y el total es la suma:
- **Prior por lado**: interacción 60% córners que genera A + 40% que concede B (generated vs conceded, §3), × Tactical_K por estilo REAL de centros de Sofascore (bandas 1.15 / central 0.92) × kCorners de liga. El total se ancla 50/50 con la mediana empírica de totales de sus últimos partidos y el ajuste se reparte proporcional entre lados.
- **Live por lado**: mezcla bayesiana `w = min/(min+28)` entre ritmo observado y prior; **Situation S del motor por marcador** (0.82–1.28, aquí la evidencia SÍ es fuerte: el que pierde ataca → córners suben) suavizada al 70%; régimen reciente por lado (clamp ±15%, ^0.5).
- **Drivers compartidos**: presión sostenida = ataques peligrosos/min vs baseline 1.1 (clamp ±12%, ^0.5) · tiros bloqueados/min vs baseline 0.09 (clamp ±10%, ^0.5 — el bloqueo es el generador mecánico del córner, pero no todo bloqueado sale: coeficiente suave a propósito, §7).

**Doble conteo evitado** (§24): ataques peligrosos y tiros bloqueados son los ÚNICOS drivers live extra (correlacionan poco entre sí); ataques totales, posesión y tiros a puerta NO entran (correlacionan con los anteriores y con el propio conteo de córners). Centros solo en el prior (estilo), nunca recontados en vivo.

## 3. Distribución y mercados

Binomial Negativa sobre los restantes: total `PHI = 1.30`, por equipo `PHI = 1.25`. Escalera P(Over) por línea para **tres mercados**: total, córners local, córners visitante (selector en el panel). Intervalo 10–90%.

**Próximo córner** (§22): carrera de Poisson entre las tasas ajustadas de cada lado → P(local siguiente), P(visitante siguiente), P(ninguno en 10'). Es un modelo simple y declarado como tal — no reutiliza la línea del total.

## 4. Edge y decisión

Igual que TI/GK: implícita (sin vig con ambas cuotas), umbral 4 pp + castigos (confianza <65 +2, antes del 20' +2, sin Under +1, **mercado por equipo +1** por su mayor varianza). BET solo con edge ≥ umbral y confianza ≥ 50 y minuto ≥ 10. Confianza separada de probabilidad, con desglose.

## 5. Variables SIN fuente → peso CERO

Ataques por banda izquierda/derecha, centros EN VIVO, entradas al área, toques en área, posesión territorial, despejes, bloqueos del portero, alineación como coeficiente, tarjeta roja como escenario estructural (11v10 — el drive general de EnVivo la captura indirectamente vía marcador/momentum; escenario dedicado pendiente de datos). Clima: visible en ContextoPartido, sin peso.

## 6. Live-backtest sin leakage

`makeLiveLog` (storage `motor_corners_livelog_v1`): snapshot por minuto con solo lo disponible en ese momento; resolución automática con las stats finales de Live-Score. MAE/acierto/Brier por tramo → dónde y desde qué minuto el modelo es confiable. Constantes recalibrables en `CORNER_MODEL` cuando haya ≥20 partidos resueltos.
