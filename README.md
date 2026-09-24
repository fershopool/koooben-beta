# Koooben beta móvil

Prototipo estático, sin dependencias ni servicios externos. Los estados de inventario, transmisión, perfil y administración están identificados como pendientes, locales o simulados.

## Probar en local

Desde esta carpeta ejecuta:

```sh
python3 -m http.server 8080
```

Abre `http://localhost:8080/` para la app cliente y `http://localhost:8080/admin.html` para el panel admin demo. También se puede abrir `index.html` directamente, aunque un servidor local reproduce mejor el comportamiento del navegador.

## Configurar enlaces oficiales

Edita `config.js`. Cada sucursal acepta:

- `rappiUrl`: URL oficial y verificada de Rappi.
- `streamUrl`: URL oficial apta para incrustarse en un `iframe`. La app también muestra un enlace a la fuente original por si el proveedor bloquea la vista incrustada.

Mantén las cadenas vacías mientras no haya URLs verificadas. La interfaz mostrará el estado pendiente sin inventarlas.

## Cargar el menú

La pantalla Menú muestra deliberadamente un estado pendiente. Cuando exista inventario verificado, reemplaza el bloque `.menu-preview` de `index.html` con productos, precios y disponibilidad derivados de esa fuente. El visual actual está etiquetado como temporal y no representa productos reales.

## Datos locales

La sucursal elegida y el perfil demo de Consentidos se guardan en `localStorage` del navegador. El QR, los puntos, las métricas y el escaneo son demostraciones sin valor ni conexión a datos reales.
