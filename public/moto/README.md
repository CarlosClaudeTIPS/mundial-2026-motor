# MotoLog 🏍️

App web (PWA) para llevar el mantenimiento de tu moto y aprender a cuidarla.
Un solo archivo HTML, sin backend ni dependencias: se instala en el móvil,
funciona sin conexión y los datos se guardan en el propio dispositivo.

## Qué hace

| Pestaña | Función |
|---------|---------|
| Inicio | Consejo del día, puntos vencidos / próximos, acciones rápidas |
| Mantenimiento | Plan con 16 puntos por defecto (aceite, cadena, frenos, neumáticos, ITV...). Cada uno con intervalo en km y/o meses, estado (al día / pronto / vencido) y barra de progreso. Editable. |
| Historial | Registro de cada intervención con fecha, km, coste, taller y notas. Gasto anual y total. |
| Combustible | Repostajes con cálculo de L/100 km, km/L y coste por 100 km. |
| Checklist | Revisión pre-ruta T-CLOCS que se reinicia cada día. |
| Aprender | 13 lecciones (motor, aceite, cadena, neumáticos, frenos, eléctrico, conducción segura, glosario...) con mini test al final de cada una. |
| Ajustes | Datos de la moto, copia de seguridad (exportar / importar JSON), moneda, instalación. |

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

Los intervalos de mantenimiento por defecto son orientativos: ajústalos a la
tabla del manual de tu moto desde la propia app.
