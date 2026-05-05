# Contexto del Proyecto: Resto-MVP

## Estado Actual (Fase 2 Completada)
Hemos finalizado exitosamente la migración del Frontend a una arquitectura SaaS Multi-Tenant lista para producción.
- **Base de Datos (Supabase)**: Tablas re-estructuradas con `tenant_id`. Políticas RLS implementadas y seguridad estricta para dueños y clientes.
- **Autenticación (Supabase Auth)**: Flujos de registro, login y logout creados (`AuthContext.jsx`, `LoginPage.jsx`).
- **Rutas Protegidas**: Módulos de administración (`/pos`, `/pagos`, `/cocina`) bloqueados tras `<ProtectedRoute>`.
- **Aislamiento Multi-Tenant**: El menú de los clientes ahora funciona bajo `/menu/:tenantId`. El frontend inyecta automáticamente el ID del usuario dueño en todas las consultas para garantizar privacidad absoluta.
- **Utilidades**: Generación de código QR (`qrcode.react`) añadida en el `MainLayout` para facilitar a los negocios compartir su menú.

## Siguientes Pasos (Fase 3)
El siguiente paso crítico es la **Integración de Pagos y Suscripciones con Stripe**.
1. Configuración de Stripe (Checkout / Payment Element).
2. Manejo de Webhooks para actualizar estados de suscripción en la Base de Datos.
3. Bloquear el acceso a `/pos` a usuarios cuya suscripción haya expirado o no exista.
4. Integración de la UI para comprar/gestionar la membresía.

## Decisiones Técnicas y de Diseño
- **Frontend**: React + Vite + Tailwind v4 + Lucide React.
- **UI/UX**: Premium Glassmorphism, paleta Slate oscura (Slate-900), detalles Naranja (Orange-500).
- **Seguridad**: Todas las llamadas a DB respetan el tenant_id. Email de confirmación desactivado en Supabase para facilitar onboarding.

## Archivos Clave
- `schema_consolidado.sql`: Única fuente de verdad de la estructura en Supabase y RLS.
- `src/context/AuthContext.jsx` y `src/context/POSContext.jsx`: Cerebros del estado global.
- `src/components/auth/ProtectedRoute.jsx`: Componente de seguridad de rutas.
- `src/layouts/MainLayout.jsx`: Contiene menú de navegación y modal QR (`qrcode.react`).

## Historial de Cambios / QA
- **Gestión de Precios de Extras**: Se añadió una tabla `extras` para registrar globalmente complementos con precio. Los componentes de creación (`NewItemModal`) y edición (`ExtrasModal`) fueron actualizados. Ahora el modal recomienda extras basados en los ingredientes e impide escribir extras manuales en modo cliente, delegando el cobro adicional al cálculo total del carrito en `TicketSidebar.jsx` y `POSContext.jsx`.
- **QA Auditoría (05/05/2026)**: Eliminado código muerto (`handleAddExtraFromSelect`), renombrado `selectedExtraId` → `manualExtraText` por claridad, corregido formato de `cartTotal` (`.toFixed(2)`), verificadas políticas RLS de `extras` en Supabase, confirmado esquema BD vs `schema_consolidado.sql` sin incongruencias. Se añadieron funciones `updateExtra` y `deleteExtra` a `POSContext`.
