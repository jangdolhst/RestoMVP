# Diseño: Reseñas Verificadas de Restaurantes

Fecha: 2026-06-27
Estado: Aprobado para planificación

## Objetivo

Agregar calificaciones y opiniones públicas para restaurantes/locales en Jamm Free, sin crear cuentas para clientes. Solo podrán opinar clientes que hayan comprado en el restaurante, usando pedidos reales como prueba. La página principal mostrará el promedio de estrellas y una sección de locales destacados, mientras que las opiniones completas vivirán en una página separada por restaurante.

## Principios

- Los clientes siguen sin tener cuenta.
- Nadie puede opinar antes de comprar.
- La seguridad no depende de localStorage, IP, MAC address ni fingerprinting.
- La base de datos debe impedir spam aunque alguien use la consola del navegador.
- La experiencia debe ser simple: estrellas de 1 a 5, nombre del cliente y comentario.
- La V1 será pequeña y mantenible; edición, reportes y moderación avanzada quedan fuera salvo campos preparados para futuro.

## Decisiones de Diseño

### Elegibilidad para Opinar

Un cliente puede dejar una reseña solo si existe un pedido válido que cumpla todas estas condiciones:

- El pedido pertenece al restaurante reseñado.
- El pedido tiene un `order_token` válido.
- El pedido está en estado `pagado`.
- El teléfono enviado para la reseña coincide con el teléfono del pedido, después de normalizarlo.
- El pedido no fue usado antes para crear otra reseña.
- El mismo teléfono normalizado no tiene ya otra reseña para ese restaurante.

Esto evita reseñas falsas antes de comprar y reduce spam sin obligar al cliente a registrarse.

### Por Qué No IP, MAC o Fingerprint

- IP no sirve porque varias personas pueden compartir una misma red y una sola persona puede cambiar de red, usar datos móviles o VPN.
- MAC address no es accesible desde una web normal por privacidad y seguridad del navegador.
- Fingerprinting es invasivo, frágil y no recomendable para este producto.

## Modelo de Datos

### Nueva Tabla: `restaurant_reviews`

Campos propuestos:

- `id uuid primary key default gen_random_uuid()`
- `restaurant_id uuid not null references restaurant_profiles(id) on delete cascade`
- `order_id uuid not null references orders(id) on delete cascade`
- `order_token uuid not null`
- `customer_name text not null`
- `customer_phone_normalized text not null`
- `rating integer not null check (rating between 1 and 5)`
- `comment text not null default ''`
- `is_hidden boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Restricciones únicas:

- `unique(order_id)` para evitar más de una reseña por pedido.
- `unique(restaurant_id, customer_phone_normalized)` para evitar múltiples reseñas del mismo teléfono en el mismo restaurante.

Índices:

- `(restaurant_id, is_hidden, created_at desc)` para listar opiniones públicas.
- `(restaurant_id, rating)` para agregaciones simples.

## Seguridad y RLS

La tabla tendrá RLS habilitado.

Políticas:

- No habrá `SELECT` público directo sobre la tabla completa, porque contiene `order_id`, `order_token` y teléfono normalizado.
- No habrá `INSERT` directo para `anon` ni `authenticated`.
- No habrá `UPDATE` público en V1.
- Los dueños de restaurantes podrán leer reseñas de su propio restaurante, incluyendo campos operativos y futuras ocultas si se implementa moderación.
- Los clientes leerán opiniones públicas mediante RPC o vista segura que excluya datos sensibles.

### RPC Pública: `create_restaurant_review`

La creación se hará mediante una función RPC `SECURITY DEFINER`, con `search_path = ''`, ejecutable por `anon`.

Parámetros:

- `p_restaurant_id uuid`
- `p_order_token uuid`
- `p_customer_name text`
- `p_phone text`
- `p_rating integer`
- `p_comment text`

Validaciones internas:

- Restaurante existe y está activo.
- Pedido existe por `order_token`.
- Pedido pertenece al restaurante.
- Pedido está `pagado`.
- Teléfono normalizado coincide con el teléfono del pedido.
- `rating` está entre 1 y 5.
- Nombre limitado a 80 caracteres.
- Comentario limitado a 800 caracteres.
- No existe reseña previa por `order_id`.
- No existe reseña previa por `(restaurant_id, customer_phone_normalized)`.

Errores controlados:

- `invalid_order` cuando el token no existe o no pertenece al restaurante.
- `order_not_paid` cuando el pedido todavía no está pagado.
- `phone_mismatch` cuando el teléfono no coincide.
- `already_reviewed` cuando el cliente ya opinó.
- `invalid_rating` cuando la calificación está fuera del rango permitido.

### RPC Pública: `get_review_eligibility`

Para una UX clara, se agregará una RPC de solo validación.

Parámetros:

- `p_restaurant_id uuid`
- `p_order_token uuid`

Respuesta propuesta:

- `eligible boolean`
- `reason text`
- `order_id uuid`
- `order_status text`
- `client_name text`
- `phone_hint text`

Esta RPC permite mostrar mensajes útiles sin exponer datos sensibles. Solo debe devolver datos mínimos del pedido asociado al token.

## Lectura Pública de Opiniones y Puntajes

Para evitar exponer datos sensibles, el frontend público no leerá `restaurant_reviews` directamente.

### RPC Pública: `get_restaurant_reviews`

Devuelve únicamente campos seguros:

- `id`
- `restaurant_id`
- `customer_name`
- `rating`
- `comment`
- `created_at`

Reglas:

- Solo devuelve reseñas `is_hidden = false`.
- Filtra por `restaurant_id`.
- Limita resultados, por ejemplo `limit 100`.
- No devuelve teléfono, `order_id` ni `order_token`.

### Resumen de Puntajes

Opción V1 recomendada: RPC pública `get_restaurant_review_summary`, para evitar dudas de permisos y bypass de RLS con vistas.

Devuelve:

- `restaurant_id`
- `average_rating numeric`
- `review_count integer`
- `five_star_count integer`
- `four_star_count integer`
- `three_star_count integer`
- `two_star_count integer`
- `one_star_count integer`

Reglas:

- Solo considera reseñas `is_hidden = false`.
- Puede aceptar `restaurant_ids uuid[]` para cargar resúmenes de todas las tarjetas del marketplace en una sola llamada.
- No expone campos de pedido ni teléfono.

## UI y Flujo Público

### Marketplace `/`

Cambios:

- Cada tarjeta de restaurante mostrará:
  - promedio de estrellas
  - cantidad de opiniones
  - texto/enlace `Ver opiniones`
- El click principal de la tarjeta seguirá abriendo el menú `/menu/:tenantId`.
- El link de opiniones debe detener propagación para no abrir el menú accidentalmente.
- Agregar sección superior `Locales destacados` antes del grid principal.

Locales destacados:

- Solo restaurantes activos.
- Ordenados por mejor promedio y mayor cantidad de reseñas.
- Umbral recomendado: mínimo 3 reseñas para destacar por rating.
- Si no hay suficientes reseñas, no mostrar la sección o mostrar restaurantes con mejores datos disponibles sin etiquetarlos exageradamente.

### Nueva Página: `/opiniones/:restaurantId`

Contenido:

- Header con regreso al directorio.
- Nombre, logo/banner y estado básico del restaurante.
- Promedio de estrellas y cantidad total de reseñas.
- Lista de opiniones públicas, ordenadas por más recientes.
- Formulario de reseña si el cliente tiene un pedido elegible.

Detección de pedidos del cliente:

- Reutilizar `resto_order_tokens` desde localStorage.
- Consultar elegibilidad por cada token local contra el restaurante actual.
- Si hay un token elegible, mostrar formulario.
- Si no hay token elegible, mostrar mensaje: `Solo clientes con pedidos pagados pueden opinar.`
- Si el pedido existe pero no está pagado, mostrar: `Podrás opinar cuando el restaurante marque tu pedido como pagado.`
- Si ya opinó, mostrar: `Ya dejaste una opinión para este local.`

Formulario:

- Estrellas 1 a 5.
- Nombre precargado desde el pedido si está disponible, editable dentro del límite.
- Teléfono requerido para confirmar coincidencia con el pedido.
- Comentario opcional en V1; si se envía, se limita a 800 caracteres.
- Después de crear reseña, recargar resumen y lista de opiniones.

## i18n

Todos los textos visibles deben agregarse a `src/i18n/resources/es.js` y `src/i18n/resources/en.js`.

Claves sugeridas:

- `reviews.title`
- `reviews.viewReviews`
- `reviews.averageRating`
- `reviews.reviewCount`
- `reviews.featuredTitle`
- `reviews.featuredSubtitle`
- `reviews.writeReview`
- `reviews.onlyPaidOrders`
- `reviews.orderNotPaid`
- `reviews.alreadyReviewed`
- `reviews.submitReview`
- `reviews.ratingRequired`
- `reviews.thanks`

## Componentes Propuestos

- `StarRating.jsx`: renderiza estrellas y permite modo solo lectura o interactivo.
- `ReviewSummaryBadge.jsx`: muestra promedio y conteo compacto para tarjetas.
- `FeaturedRestaurantsSection.jsx`: sección de destacados en marketplace.
- `ReviewsPage.jsx`: página completa de opiniones.
- Helpers en `src/lib/reviews.js` para normalizar datos y mapear errores RPC a textos i18n.

## Cambios de Rutas

Agregar ruta pública:

- `/opiniones/:restaurantId`

No cambia el flujo de pedidos, login, pagos, POS ni cocina.

## Compatibilidad con Pedidos Existentes

Los pedidos actuales tienen `order_token`, `phone`, `tenant_id` y `status`, por lo que pueden usarse como prueba si están `pagado`.

Si un cliente hizo pedido antes de esta feature y conserva el token en su navegador, podrá opinar cuando el pedido esté pagado.

## Riesgos y Mitigaciones

- Cliente borra localStorage: no verá automáticamente el botón/formulario, pero puede recuperar su pedido desde `/pedidos` si conserva el token guardado en ese navegador. En V1 no se implementa recuperación por teléfono.
- Restaurante no marca pedidos como pagados: los clientes no podrán opinar. Esto incentiva usar correctamente `/pagos`.
- Comentarios abusivos: V1 no incluye moderación, pero `is_hidden` queda listo para ocultar reseñas en una V2.
- Intentos desde consola: bloqueados por RLS y RPC con validaciones internas.
- Una persona con varios teléfonos puede opinar varias veces si hace compras reales con distintos teléfonos. Esto es aceptable para V1.

## Plan de Verificación

Base de datos:

- Verificar que `anon` no puede insertar directo en `restaurant_reviews`.
- Verificar que `anon` puede leer reseñas públicas solo mediante RPC segura y sin campos sensibles.
- Verificar que RPC rechaza pedido inexistente.
- Verificar que RPC rechaza pedido no pagado.
- Verificar que RPC rechaza teléfono que no coincide.
- Verificar que RPC rechaza rating fuera de 1-5.
- Verificar que RPC crea reseña para pedido pagado válido.
- Verificar que segunda reseña del mismo pedido falla.
- Verificar que segunda reseña del mismo teléfono/restaurante falla.

Frontend:

- `npm run lint`.
- `npm run build`.
- Smoke de `/` con restaurantes sin reseñas.
- Smoke de `/` con restaurantes con reseñas.
- Smoke de `/opiniones/:restaurantId` sin token local.
- Smoke de `/opiniones/:restaurantId` con token no pagado.
- Smoke de `/opiniones/:restaurantId` con token pagado.
- Verificar mobile y desktop.

## Fuera de Alcance V1

- Cuentas de cliente.
- Edición de reseñas.
- Likes/dislikes en opiniones.
- Fotos en opiniones.
- Respuestas del restaurante.
- Moderación desde panel.
- Reportes de abuso.
- Detección por IP, MAC o fingerprinting.
