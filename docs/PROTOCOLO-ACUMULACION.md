# PROTOCOLO DE ACUMULACIÓN — Tu manual desde hoy (v5.1)

> La arquitectura está **CONGELADA**. Tu trabajo cambió: ya no eres el que mejora el modelo — eres quien **alimenta y audita el experimento**. En una frase: *tu trabajo es no tocar el modelo y dejar que se equivoque; sus errores son los datos que dirán qué cambiar.*

## Reglas de oro (las 5 que más importan)

1. **NO tocar parámetros nunca** — ni porque "los córners están saliendo altos". Eso es overfitting manual en tiempo real. Si ves algo raro: anótalo como hipótesis y espera datos. Las alertas del sistema dicen INVESTIGAR, no ajustar.
2. **Registra TODO pick elegible, no solo los que te gustan.** Si miras 30 partidos y solo registras los 4 bonitos, destruyes la muestra. La app lo hace sola cuando ingresas línea+cuota — hazlo en cada partido que analices, aunque el veredicto sea NO BET.
3. **0 apuestas al día es válido.** Tu límite de 4 es un MÁXIMO, no una meta. Si sientes "tengo que llenar las cuatro", estás metiendo sesgo humano.
4. **PAPER ≠ dinero real.** Durante esta fase no valides el modelo con plata. Tu bankroll va separado del experimento. Y no mezcles: que una PAPER BET que jugaste de verdad haya ganado NO la convierte en mejor evidencia.
5. **No mires el ROI de las últimas 10.** Ni "llevo 7 verdes" ni "llevo 5 rojas" — eso es resultado, no evidencia. La pregunta del experimento es: *¿qué habría pasado siguiendo mecánicamente las reglas?*

## Tu rutina

**PREMATCH** (cuando analices un partido en Analizar):
- La predicción se guarda sola. Si tienes la línea/cuota de tu casa, ingrésalas en los módulos — eso registra la evaluación completa (BET o NO BET, con su razón).
- La combinada sugerida también se registra sola con sus dos patas.

**LIVE** (cuando sigas un partido en En Vivo):
- Solo abre el partido y deja la app trabajando — los snapshots se guardan cada minuto solos.
- Si ingresas línea+cuota, la evaluación queda en el audit log con su minuto exacto.
- No "ayudes" al modelo corrigiendo números a mano salvo que la API no traiga el dato.

**POSTPARTIDO**: nada — la resolución es automática. Lo único manual valioso: si apostaste de verdad o quieres CLV, **anota la cuota de cierre** (la del mercado justo antes del final) — rutina simple: entrada → cierre.

**SEMANAL** (una vez, no cada 2 partidos): abre **Rendimiento → 🔬 MODEL HEALTH** y mira por mercado: N, MAE vs naive, bias, CRPS, cobertura, sharpness, alertas. Solo mirar — no actuar.

## Checkpoints (números = puntos de revisión, NUNCA acciones automáticas)

- **~50 partidos/mercado** → primer diagnóstico formal (¿gana al naive? ¿calibrado? ¿sesgo? ¿tramos LIVE?). Diagnóstico, NO recalibración.
- **~100** → revisión ampliada. **~250** → revisión profunda de parámetros SI los datos lo piden. **~500** → decidir si algún experimental (hazard, tempo) merece entrar — solo si los datos lo piden.

## Las 5 señales que SÍ justificarían tocar el modelo (y ninguna otra)

1. **Sesgo persistente**: predice 8.8 córners y salen 7.5-7.7 una y otra vez.
2. **Pierde contra el naive** en CRPS/MAE de forma consistente en varios segmentos.
3. **Error concentrado en un tramo**: bueno 0-60', sobreestima sistemáticamente 60-90' → eso (y solo eso) abriría el experimento de hazard.
4. **Mala calibración**: dice 70% y ocurre 58% repetidamente — peor que perder una semana.
5. **El tempo no aporta**: si NB vs NB+tempo no muestra diferencia con muestra razonable → el tempo se elimina, sin nostalgia.

Cuando aparezca una de estas con muestra suficiente, se redacta una **MODEL CHANGE PROPOSAL** (problema → evidencia → hipótesis → cambio → métrica → validación fuera de muestra) y AHÍ sí se toca el código.

## Métrica de éxito real (en este orden, no al revés)

¿Supera consistentemente a sus benchmarks? → ¿Las probabilidades están calibradas? → ¿Eso se traduce en CLV? → ¿Eso se traduce en ROI?
