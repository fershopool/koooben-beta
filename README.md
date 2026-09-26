# Koooben beta móvil

Prototipo estático con un servidor opcional para Apple Wallet. El perfil local sigue siendo demo.

## Apple Wallet

El servidor mínimo está en `wallet-server.mjs`: genera un `Generic Pass`, lo firma con OpenSSL y expone el servicio de actualización de Apple (`/v1`).

1. En Apple Developer crea el `Pass Type ID`, descarga el certificado y consigue el certificado WWDR vigente.
2. Copia `.env.example` a `.env` y completa el identificador del pase, equipo, certificado, llave y una URL pública HTTPS.
3. Exporta las variables y arranca `npm run wallet`.
4. En `config.js`, configura `walletApiUrl` con la URL del servidor.

La descarga usa `GET /api/wallet/pass?name=...&email=...`. Para administración, `PUT /api/wallet/members/:serial` actualiza el pase y `POST /api/wallet/revoke/:serial` lo marca como revocado; ambos requieren `X-Wallet-Admin-Token`.

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

La sucursal elegida y el perfil demo de Consentidos se guardan en `localStorage` del navegador. El panel admin puede leer QR con la cámara del dispositivo: solicita permiso, usa el lector nativo cuando existe y usa `jsQR` como respaldo. La cámara requiere `https` o `localhost`; si el permiso se rechaza, usa el folio o enlace manual. La validación de puntos y estado real todavía debe venir de tu base de datos, no del navegador.

## Clientes reales y Tlatolli

Configura koobenApiUrl en config.js con la URL HTTPS de Identificador_tlatolli desplegada en Ollin.

El panel admin envía nombre y celular a /api/admin/kooben/clients. El backend genera el identificador aleatorio, guarda el cliente en la base privada y devuelve solo el folio y la URL pública de verificación.

La clave administrativa se escribe en el panel y no se guarda en config.js ni localStorage. En producción, limita el origen con KOOOBEN_ALLOWED_ORIGIN y usa HTTPS.
