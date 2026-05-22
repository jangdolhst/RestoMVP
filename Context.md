# Contexto del Proyecto: Resto-MVP

## Estado Actual (Fase 2 Completada)
Hemos finalizado exitosamente la migraciÃ³n del Frontend a una arquitectura SaaS Multi-Tenant lista para producciÃ³n.
- **Base de Datos (Supabase)**: Tablas re-estructuradas con `tenant_id`. PolÃ­ticas RLS implementadas y seguridad estricta para dueÃ±os y clientes.
- **AutenticaciÃ³n (Supabase Auth)**: Flujos de registro, login y logout creados (`AuthContext.jsx`, `LoginPage.jsx`).
- **Rutas Protegidas**: MÃ³dulos de administraciÃ³n (`/pos`, `/pagos`, `/cocina`) bloqueados tras `<ProtectedRoute>`.
- **Aislamiento Multi-Tenant**: El menÃº de los clientes ahora funciona bajo `/menu/:tenantId`. El frontend inyecta automÃ¡ticamente el ID del usuario dueÃ±o en todas las consultas para garantizar privacidad absoluta.
- **Utilidades**: GeneraciÃ³n de cÃ³digo QR (`qrcode.react`) aÃ±adida en el `MainLayout` para facilitar a los negocios compartir su menÃº.

## Siguientes Pasos (Fase 3)
El siguiente paso crÃ­tico es la **IntegraciÃ³n de Pagos y Suscripciones con Stripe**.
1. ConfiguraciÃ³n de Stripe (Checkout / Payment Element).
2. Manejo de Webhooks para actualizar estados de suscripciÃ³n en la Base de Datos.
3. Bloquear el acceso a `/pos` a usuarios cuya suscripciÃ³n haya expirado o no exista.
4. IntegraciÃ³n de la UI para comprar/gestionar la membresÃ­a.

## Decisiones TÃ©cnicas y de DiseÃ±o
- **Frontend**: React + Vite + Tailwind v4 + Lucide React.
- **UI/UX**: Premium Glassmorphism, paleta Slate oscura (Slate-900), detalles Naranja (Orange-500).
- **Seguridad**: Todas las llamadas a DB respetan el tenant_id. Email de confirmaciÃ³n desactivado en Supabase para facilitar onboarding.

## Archivos Clave
- `schema_consolidado.sql`: Ãšnica fuente de verdad de la estructura en Supabase y RLS.
- `src/context/AuthContext.jsx` y `src/context/POSContext.jsx`: Cerebros del estado global.
- `src/components/auth/ProtectedRoute.jsx`: Componente de seguridad de rutas.
- `src/layouts/MainLayout.jsx`: Contiene menÃº de navegaciÃ³n y modal QR (`qrcode.react`).

## Historial de Cambios / QA
- **GestiÃ³n de Precios de Extras**: Se aÃ±adiÃ³ una tabla `extras` para registrar globalmente complementos con precio. Los componentes de creaciÃ³n (`NewItemModal`) y ediciÃ³n (`ExtrasModal`) fueron actualizados. Ahora el modal recomienda extras basados en los ingredientes e impide escribir extras manuales en modo cliente, delegando el cobro adicional al cÃ¡lculo total del carrito en `TicketSidebar.jsx` y `POSContext.jsx`.
- **QA AuditorÃ­a (05/05/2026)**: Eliminado cÃ³digo muerto (`handleAddExtraFromSelect`), renombrado `selectedExtraId` â†’ `manualExtraText` por claridad, corregido formato de `cartTotal` (`.toFixed(2)`), verificadas polÃ­ticas RLS de `extras` en Supabase, confirmado esquema BD vs `schema_consolidado.sql` sin incongruencias. Se aÃ±adieron funciones `updateExtra` y `deleteExtra` a `POSContext`.
- **ValidaciÃ³n TelefÃ³nica Internacional (05/05/2026)**: Integrado `intl-tel-input` v28 + `@intl-tel-input/react` como paquetes npm. Componente reutilizable `PhoneInput` (`src/components/ui/PhoneInput.jsx`) con detecciÃ³n automÃ¡tica de paÃ­s desde el navegador, `separateDialCode`, validaciÃ³n en tiempo real, y estilos glassmorphism en `index.css`. Reemplazados 2 inputs `type="tel"` nativos en `TicketSidebar.jsx`. El telÃ©fono se guarda en formato E.164 (`+521234567890`).
- **AuditorÃ­a de Seguridad (05/05/2026)**: AnÃ¡lisis de 7 vectores de ataque (XSS, SQL Injection, RLS bypass, RPC exposure, headers HTTP, credenciales, rutas). Se corrigieron 5 vulnerabilidades:
  - *VULN-1 (CrÃ­tica)*: PolÃ­ticas RLS de `orders` y `order_items` cambiadas de `WITH CHECK (true)` a validaciÃ³n contra `auth.users` y `orders` respectivamente.
  - *VULN-2/3 (Alta)*: `REVOKE EXECUTE FROM PUBLIC` en `handle_new_user()` y `rls_auto_enable()` para bloquear invocaciÃ³n vÃ­a REST API.
  - *VULN-4 (Media)*: `SET search_path = public` en `handle_new_user()`.
  - *VULN-6 (Baja)*: Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) aÃ±adidos a `vercel.json`.
  - *VULN-5 (Media)*: Leaked Password Protection pendiente de activar manualmente en Dashboard de Supabase â†’ Auth â†’ Settings.
- **Fix PhoneInput en Settings (17/05/2026)**: Integrado el componente reutilizable `PhoneInput` (intl-tel-input) en `SettingsPage.jsx`, reemplazando el `<input type="tel">` nativo. Ahora valida formato internacional con cÃ³digo de paÃ­s.
- **Fix BotÃ³n "Enviar Orden" (17/05/2026)**: El bug era causado por `.select().single()` despuÃ©s del INSERT en `POSContext.placeOrder()`. El RLS de SELECT solo permite lectura al dueÃ±o (`auth.uid() = tenant_id`), por lo que clientes anÃ³nimos obtenÃ­an `null`. Se eliminÃ³ `.select()` y se recupera la orden creada via RPC `get_orders_by_tokens`. Ahora `placeOrder()` retorna `{ success: true, orderToken }`.
- **Seguimiento de Pedidos sin SesiÃ³n (17/05/2026)**: Nueva funcionalidad para que clientes sin cuenta puedan rastrear sus pedidos:
  - *VULN-6 (Baja)*: Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) añadidos a `vercel.json`.
  - *VULN-5 (Media)*: Leaked Password Protection pendiente de activar manualmente en Dashboard de Supabase → Auth → Settings.
- **Fix PhoneInput en Settings (17/05/2026)**: Integrado el componente reutilizable `PhoneInput` (intl-tel-input) en `SettingsPage.jsx`, reemplazando el `<input type="tel">` nativo. Ahora valida formato internacional con código de país.
- **Fix Botón "Enviar Orden" (17/05/2026)**: El bug era causado por `.select().single()` después del INSERT en `POSContext.placeOrder()`. El RLS de SELECT solo permite lectura al dueño (`auth.uid() = tenant_id`), por lo que clientes anónimos obtenían `null`. Se eliminó `.select()` y se recupera la orden creada via RPC `get_orders_by_tokens`. Ahora `placeOrder()` retorna `{ success: true, orderToken }`.
- **Seguimiento de Pedidos sin Sesión (17/05/2026)**: Nueva funcionalidad para que clientes sin cuenta puedan rastrear sus pedidos:
  - Columna `order_token UUID` agregada a tabla `orders` con índice para búsqueda rápida.
  - RPC `get_orders_by_tokens(UUID[])` creada con `SECURITY DEFINER` — devuelve solo campos públicos.
  - Al enviar orden, se genera token con `crypto.randomUUID()` y se guarda en `localStorage` (máx. 20 tokens).
  - Nueva página `/pedidos` (`OrderTrackingPage.jsx`) muestra estado visual con auto-refresh cada 15s.
  - Enlace "Mis Pedidos" visible en el header del Marketplace si hay tokens guardados.
  - Seguridad: sin token no se puede ver ningún pedido. UUID v4 tiene 2^122 combinaciones = imposible de adivinar.
- **Fix Definitivo Bug Infinite Loop en PhoneInput (19/05/2026)**: Se resolvió por completo el error crítico ('Maximum update depth exceeded') que causaba que `SettingsPage` colapsara y dejara de renderizar ('no se ve el contenido'). Inicialmente se retiró el `useEffect` problemático, pero el error persistía porque el componente controlado de `@intl-tel-input/react` seguía emitiendo eventos `onChangeNumber` al recibir el prop `value`, lo que generaba un bucle con el re-render de `SettingsPage`.
  - Se implementó un control de igualdad estricta (`safeNum !== value`) dentro de `handleChangeNumber` en `PhoneInput.jsx`.
  - Ahora el input solo emite el nuevo valor si realmente hubo un cambio desde la perspectiva del usuario o del formateo, rompiendo efectivamente el ciclo de actualizaciones infinitas.
  - Se validó el renderizado a través de un test E2E con Playwright sobre el servidor de desarrollo en la ruta `/test-settings`, confirmando la ausencia de errores en consola y logrando renderizado exitoso de la UI.
- **Fix RLS Orders Permission Denied (19/05/2026)**: Se resolvió un error 403 (Forbidden) al insertar una orden ('permission denied for table users'). El error ocurría porque la política RLS 'Clientes pueden insertar órdenes' hacía un SELECT a auth.users, tabla a la cual los usuarios 'authenticated' y 'anon' no tienen acceso de lectura directo, provocando que Postgres rechazara toda la operación. Se modificó el RLS de 'orders' para verificar contra 'restaurant_profiles' en su lugar, y se simplificó el RLS de 'order_items' para depender de la integridad referencial (FOREIGN KEY) sin subconsultas problemáticas a 'orders', permitiendo la creación fluida de pedidos por clientes.
- **Correlativo Diario de Pedidos por Restaurante (19/05/2026)**: Se solucionó el problema donde los números de pedido eran globales y acumulativos (`SERIAL`).
  - Se modificó la columna `order_number` de `SERIAL` a `INTEGER` en `schema_consolidado.sql` (eliminando la secuencia global por defecto en base de datos).
  - Se implementó la función y trigger `set_next_order_number()` en PostgreSQL para calcular dinámicamente el siguiente número correlativo (`MAX(order_number) + 1`) de manera aislada por restaurante (`tenant_id`) y **reiniciándose a #1 cada día** (`created_at::date = CURRENT_DATE`).
  - Esto garantiza que cada restaurante tenga su propia secuencia diaria de pedidos independiente.
- **Historial de Pedidos en Cliente (19/05/2026)**: Se separaron los pedidos activos de los completados en `OrderTrackingPage.jsx`. Los pedidos marcados como `pagado` ahora desaparecen de la vista principal y se agrupan bajo un nuevo botón "Ver historial de pedidos", manteniendo la pantalla principal limpia para el usuario.
- **Módulo de Mapa Interactivo (20/05/2026)**: Se implementó un mapa interactivo a pantalla completa (`/mapa`) con las siguientes características:
  - **Librería**: `leaflet` + `react-leaflet` con tiles de OpenStreetMap (gratuito, sin API key).
  - **Geocodificación en Settings**: Al escribir la dirección en "Mi Negocio", se geocodifica automáticamente usando Nominatim (debounce 1.5s) y se muestra un mini-mapa de confirmación debajo. El marcador es draggable para ajuste manual. Se guardan `latitude` y `longitude` en `restaurant_profiles`.
  - **Base de Datos**: Se agregaron columnas `latitude NUMERIC(10,7)` y `longitude NUMERIC(10,7)` a `restaurant_profiles`. SQL: `ALTER TABLE restaurant_profiles ADD COLUMN latitude NUMERIC(10,7); ALTER TABLE restaurant_profiles ADD COLUMN longitude NUMERIC(10,7);`
  - **GPS del Cliente**: Al abrir el mapa, se solicita permiso de geolocalización. Si acepta, se muestra un punto azul pulsante con su ubicación y el mapa se centra en él. Si no acepta, se muestra un aviso.
  - **Marcadores Personalizados**: Cada restaurante se muestra con un marcador circular que contiene su `logo_url`. Al hacer clic, se abre un popup flotante glassmorphism con banner, info, 3 productos destacados y botón "Ver Local".
  - **Nuevo Componente**: `AddressMapPreview.jsx` (mini-mapa reutilizable para Settings).
  - **Nuevo Componente**: `RestaurantPreviewPopup.jsx` (popup flotante glassmorphism).
  - **Nuevo Componente**: `MapPage.jsx` (página completa del mapa).
  - **Ruta**: `/mapa` (pública, accesible desde botón "Ver en Mapa" en el Marketplace).
  - **Dark Theme**: Tiles de OpenStreetMap oscurecidos con filtros CSS. Controles de zoom y atribución con glassmorphism.
- **Fix GPS Permissions-Policy (20/05/2026)**: El GPS no funcionaba en producción porque `vercel.json` tenía `geolocation=()` que bloqueaba la API Geolocation a nivel HTTP. Se cambió a `geolocation=(self)` para permitir GPS solo en el dominio propio.
- **Fix Validación de Teléfono en Órdenes (21/05/2026)**: El componente `PhoneInput` (intl-tel-input) validaba internamente si el número era correcto (largo, formato, país), pero **no comunicaba** ese estado al componente padre. Se agregó prop `onValidityChange` a `PhoneInput.jsx` y se conectó a `TicketSidebar.jsx` con un state `isPhoneValid`. Ahora el botón "Enviar Orden" bloquea el envío si el número no pasa la validación de intl-tel-input (largo correcto para el país seleccionado).
- **Confirmación de Órdenes por WhatsApp (21/05/2026)**:
  - **Flujo**: Cliente envía orden → se crea con `status: pendiente_confirmacion` + `confirmation_code` de 4 chars → se abre modal con botón WhatsApp → cliente envía mensaje con código al restaurante → restaurante confirma en dashboard ("Órdenes") → orden pasa a `pendiente_cocina` y aparece en Cocina.
  - **Código de confirmación**: 4 caracteres alfanuméricos sin ambiguos (sin O/0/I/1/L). Pool: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
  - **Auto-cancelación**: Órdenes con más de 15 min en `pendiente_confirmacion` se auto-cancelan.
  - **Sonido**: Triple beep via Web Audio API cuando llega un nuevo pedido por confirmar.
  - **Navegación renombrada**: "Órdenes" → "Menú", "Pagos" → "Órdenes".
  - **Archivos**: `WhatsAppConfirmationModal.jsx` (nuevo), `POSContext.jsx`, `TicketSidebar.jsx`, `PagosPage.jsx`, `OrderTrackingPage.jsx`, `MainLayout.jsx`.
  - **DB**: Columna `confirmation_code CHAR(4)` + status CHECK actualizado con `pendiente_confirmacion` y `cancelado`.
- **Mobile Bottom Navigation + Perfil (21/05/2026)**:
  - **Bottom Nav**: `MobileBottomNav.jsx` — barra inferior glassmorphism con 5 tabs (Inicio, Pedidos, Mapa, Perfil, Negocios). Solo visible en mobile (`lg:hidden`). Se oculta en `/menu/:tenantId` y rutas admin.
  - **Perfil**: `UserProfilePage.jsx` — guarda nombre y teléfono en `localStorage` key `resto_user_profile`. Sin registro.
  - **Auto-fill**: `POSContext.jsx` lee el perfil de localStorage y pre-rellena `clientName` y `phone` al entrar a un menú de restaurante.
  - **Ajustes mobile**: MarketplacePage oculta botones header en mobile, OrderTrackingPage/MapPage con `pb-28` para no tapar bottom nav, footer oculto en mobile.
  - **Safe-area**: `viewport-fit=cover` en index.html + `.pb-safe` en CSS para iPhone.
  - **Notificador global**: `PendingOrderNotifier.jsx` en MainLayout reproduce sonido en TODAS las páginas. Evento `orders-updated` detiene sonido inmediatamente al confirmar/rechazar.
