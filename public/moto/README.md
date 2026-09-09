# MotoLog 🏍️ · Suzuki Gixxer 155 FI ABS 2024

App web (PWA) para llevar el mantenimiento de una Suzuki Gixxer 155 FI ABS 2024
(uso personal, Colombia) y aprender a cuidarla.
Un solo archivo HTML, sin backend ni dependencias: se instala en el móvil,
funciona sin conexión y los datos se guardan en el propio dispositivo.

## Qué hace

| Pestaña | Función |
|---------|---------|
| Inicio | Consejo del día, puntos vencidos / próximos, acciones rápidas |
| Mantenimiento | Plan de 19 puntos basado en el programa Suzuki de la Gixxer (servicio a 1.000 km y luego cada 3.000 km): aceite, filtros, bujía, válvulas, cadena, frenos, mangueras, llantas, cables, batería, tornillería, horquilla, más SOAT y revisión técnico-mecánica. Cada uno con intervalo en km y/o meses, estado (al día / pronto / vencido) y barra de progreso. Editable. |
| Historial | Registro de cada intervención con fecha, km, coste, taller y notas. Gasto anual y total. |
| Combustible | Tanqueadas con cálculo de L/100 km, km/L y costo por 100 km (referencia Gixxer: 40-50 km/L). |
| Checklist | Revisión pre-ruta T-CLOCS que se reinicia cada día. |
| Aprender | 14 lecciones, la primera dedicada a la Gixxer (refrigeración por aire y aceite, ABS, valores clave, plan Suzuki, trámites en Colombia), más motor, aceite, cadena, llantas, frenos, eléctrico, conducción segura y glosario. Mini test al final de cada una. |
| Ajustes | Ficha técnica de la Gixxer (aceite, bujía, presiones, cadena, frenos, tanque...), datos de la moto, copia de seguridad (exportar / importar JSON), moneda (pesos por defecto), instalación. |

## Usarla

- **En desarrollo:** `npm run dev` en la raíz del repo y abre `http://localhost:5173/moto/`.
- **Desplegada:** al estar en `public/`, Vite la copia tal cual y queda en `https://<tu-dominio>/moto/`.
- **Sin build:** también puedes abrir `index.html` directamente o subir la carpeta a cualquier hosting estático.

## Instalar en el móvil

- **Android (Chrome):** menú ⋮ → *Instalar aplicación* / *Añadir a pantalla de inicio*.
- **iPhone (Safari):** botón compartir → *Añadir a pantalla de inicio*.

## Datos

Todo se guarda en `localStorage` bajo la clave `motolog_v1`. Exporta una copia desde
Ajustes antes de cambiar de móvil o borrar datos del navegador.

## Estructura

```
public/moto/
├── index.html           # La app completa (HTML + CSS + JS)
├── manifest.webmanifest # Metadatos PWA
├── sw.js                # Service worker (caché offline)
└── icon.svg             # Icono
```

## Adaptar a otra moto

Los datos específicos están en dos constantes al inicio del script de `index.html`:
`BIKE` (ficha técnica) y `DEFAULT_ITEMS` (plan de mantenimiento). `PLAN_VERSION`
controla la migración: al cambiarla, los dispositivos con datos guardados actualizan
el plan conservando historial y puntos personalizados.
