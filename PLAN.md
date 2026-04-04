# Plan - Plataforma SaaS Multi-Tenant

---

## 🤖 Prompt para Sergio (Agenda de Citas)

Sergio, copia y pega esto en tu IA cuando vayas a trabajar en tu parte:

> Soy desarrollador trabajando en una plataforma SaaS multi-tenant. Mi tarea es construir el módulo de **Agenda de Citas**. El stack es:
>
> - **Backend:** Node.js + Express + TypeScript
> - **ORM:** Prisma con SQLITE
> - **Auth:** JWT + bcrypt (ya implementado por el equipo)
> - **Multi-tenant:** Cada query se filtra por `tenantId` usando middleware de Prisma (ya implementado)
>
> **Mi módulo (agenda-citas) necesita:**
>
> **Tablas (ya definidas en Prisma schema):**
> - `Appointment` — id, tenantId, serviceId, clientName, clientPhone, clientEmail, date, time, status (PENDING, CONFIRMED, CANCELLED, COMPLETED), notes
> - `AvailableSlot` — id, tenantId, serviceId, dayOfWeek, startTime, endTime, active
>
> **Endpoints que debo crear:**
> ```
> GET    /api/appointments         → Listar citas del tenant (auth requerido)
> POST   /api/appointments         → Agendar cita (público, sin auth)
> PUT    /api/appointments/:id     → Actualizar estado (auth requerido)
> DELETE /api/appointments/:id     → Cancelar cita (auth requerido)
> GET    /api/appointments/slots   → Horarios disponibles (público)
> POST   /api/appointments/slots   → Configurar horarios (auth requerido)
> ```
>
> **Reglas importantes:**
> - SIEMPRE filtrar por `tenantId` (viene en `req.tenant.id` del middleware)
> - Validar inputs con Zod
> - No permitir agendar en slots ya tomados o inactivos
> - Los endpoints públicos NO requieren auth pero SÍ requieren `tenantId` (viene del subdominio)
> - Los endpoints admin SÍ requieren auth + tenantId
> - Seguir la estructura: routes → controllers → services
>
> Ayúdame a implementar esto paso a paso. El backend ya tiene la base configurada (Express, Prisma, auth, middleware de tenant). Yo solo necesito crear los archivos de mi módulo dentro de `backend/src/routes/`, `backend/src/controllers/` y `backend/src/services/`.

---

## Visión General
Plataforma SaaS multi-tenant y **multiplataforma** (Web, APK, Desktop). Un cliente se registra, elige sus servicios y obtiene su ecosistema digital completo: página web con subdominio, app móvil y punto de venta de escritorio. **Un solo login, todas las plataformas.**

### Asignación de módulos
| Módulo | Responsable |
|--------|------------|
| Base (auth, tenant, prisma, infra) | Tú |
| Menú Digital + POS | Tú |
| **Agenda de Citas** | **Sergio** |
| APK (React Native) | Ambos |
| Desktop POS (Electron) | Tú |
| Frontend Web | Ambos (después del backend) |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend (API)** | Node.js + Express + TypeScript |
| **ORM** | Prisma |
| **Base de datos** | PostgreSQL |
| **Auth** | JWT + bcrypt (refresh tokens) |
| **Web Frontend** | React (Vite) |
| **Mobile (APK)** | React Native (Android/iOS) |
| **Desktop POS (.exe)** | Electron + React |
| **Tunnel** | Cloudflare Tunnel |
| **Subdominios** | Wildcard DNS + middleware tenant |
| **Tiempo real** | WebSockets (Socket.io) — pedidos POS a cocina |

---

## Arquitectura Multiplataforma

```
                    [Un solo Backend API]
                    (Express + Prisma + PostgreSQL)
                            │
              ┌─────────────┼──────────────┐
              │             │              │
         [Web SPA]    [APK Mobile]    [.exe POS]
          React        React Native    Electron
          Vite        (Android/iOS)    (Escritorio)
              │             │              │
              └─────────────┼──────────────┘
                            │
                   [Login Unificado]
                    Mismo JWT para todo
                    Mismo tenantId
                    Detección automática de servicios
```

### Flujo de Login Unificado
1. Usuario se loguea desde cualquier plataforma (web, apk, exe)
2. API valida credenciales → devuelve JWT + datos del tenant
3. El JWT incluye: `userId`, `tenantId`, `role`
4. La app consulta `/api/services` → detecta qué servicios tiene activos
5. Redirige automáticamente al módulo correcto

### Infraestructura
```
[Cloudflare Tunnel]
        |
   [Wildcard DNS *.tudominio.com]
        |
   ┌────┴────┐
   │  NGINX  │  (proxy reverso, resuelve subdominios)
   └────┬────┘
   ┌────┴────────────────┐
   │                     │
[Frontend React]   [API Express]
   (SPA)                 │
                    [Prisma ORM]
                         │
                   [PostgreSQL]
                  (shared DB, tenant isolation)
```

---

## Modelo Multi-Tenant

**Estrategia:** Shared Database, Shared Schema con `tenantId` en cada tabla.

Cada query se filtra automáticamente por `tenantId` mediante un middleware de Prisma.

---

## Base de Datos - Esquema Principal

### Tablas Core

- **Tenant** — Cada negocio registrado
  - id, slug (subdominio), name, plan, logo, customDomain, createdAt

- **User** — Usuarios de la plataforma
  - id, tenantId, email, passwordHash, role (OWNER, ADMIN, STAFF, CASHIER, KITCHEN), createdAt

- **RefreshToken** — Tokens de sesión
  - id, userId, token, expiresAt

### Tablas de Servicios

- **Service** — Tipo de servicio activo por tenant
  - id, tenantId, type (MENU_DIGITAL, APPOINTMENT, POS, LANDING), config (JSON), active

### Tablas Menú Digital

- **MenuCategory** — Categorías del menú
  - id, tenantId, serviceId, name, order

- **MenuItem** — Productos del menú
  - id, tenantId, serviceId, categoryId, name, description, price, image, order, active

### Tablas Agenda de Citas (Sergio)

- **Appointment** — Citas agendadas
  - id, tenantId, serviceId, clientName, clientPhone, clientEmail, date, time, status (PENDING, CONFIRMED, CANCELLED, COMPLETED), notes

- **AvailableSlot** — Horarios disponibles
  - id, tenantId, serviceId, dayOfWeek, startTime, endTime, active

### Tablas POS (Punto de Venta)

- **Table** — Mesas del restaurante
  - id, tenantId, number, name, capacity, status (AVAILABLE, OCCUPIED, RESERVED, CLEANING), zone

- **Order** — Pedidos
  - id, tenantId, tableId, userId (mesero), orderNumber, status (PENDING, IN_KITCHEN, READY, DELIVERED, PAID, CANCELLED), type (DINE_IN, TAKEOUT, DELIVERY), subtotal, tax, discount, total, notes, createdAt

- **OrderItem** — Items de cada pedido
  - id, orderId, menuItemId, quantity, unitPrice, subtotal, notes (sin cebolla, extra queso, etc.), status (PENDING, PREPARING, READY, DELIVERED)

- **Payment** — Pagos
  - id, tenantId, orderId, method (CASH, CARD, TRANSFER), amount, change, reference, createdAt

- **Ticket** — Tickets / Recibos
  - id, tenantId, orderId, paymentId, ticketNumber, data (JSON), printedAt

- **CashRegister** — Cortes de caja
  - id, tenantId, userId, openedAt, closedAt, openingAmount, closingAmount, expectedAmount, difference, notes

- **InventoryItem** — Inventario
  - id, tenantId, name, unit (KG, L, PZ, etc.), currentStock, minStock, cost, active

- **InventoryMovement** — Movimientos de inventario
  - id, tenantId, inventoryItemId, type (IN, OUT, ADJUSTMENT, WASTE), quantity, reason, userId, createdAt

- **KitchenDisplay** — Comandas a cocina (en tiempo real)
  - id, tenantId, orderId, items (JSON), status (PENDING, PREPARING, READY), sentAt, completedAt

### Tablas Landing Page (Opcional)

- **Page** — Páginas personalizadas
  - id, tenantId, serviceId, title, content (JSON/HTML), slug, published

---

## API - Endpoints Principales

### Auth (login unificado — web, apk, exe)
```
POST   /api/auth/register       → Crear cuenta + tenant
POST   /api/auth/login          → Login, devuelve JWT + servicios activos
POST   /api/auth/refresh        → Refresh token
POST   /api/auth/logout         → Invalidar token
GET    /api/auth/me             → Info del usuario + tenant + servicios
```

### Tenant (panel admin)
```
GET    /api/tenant/me            → Info del tenant actual
PUT    /api/tenant/me            → Actualizar perfil, logo, config
```

### Servicios
```
GET    /api/services             → Listar servicios del tenant
POST   /api/services             → Activar un servicio
PUT    /api/services/:id         → Configurar servicio
DELETE /api/services/:id         → Desactivar servicio
```

### Menú Digital
```
GET    /api/menu/categories      → Listar categorías
POST   /api/menu/categories      → Crear categoría
PUT    /api/menu/categories/:id  → Editar categoría
DELETE /api/menu/categories/:id  → Eliminar categoría
GET    /api/menu/items           → Listar items
POST   /api/menu/items           → Crear item
PUT    /api/menu/items/:id       → Editar item
DELETE /api/menu/items/:id       → Eliminar item
```

### Citas (Sergio)
```
GET    /api/appointments         → Listar citas (admin)
POST   /api/appointments         → Agendar cita (público)
PUT    /api/appointments/:id     → Actualizar estado
DELETE /api/appointments/:id     → Cancelar cita
GET    /api/appointments/slots   → Horarios disponibles (público)
POST   /api/appointments/slots   → Configurar horarios (admin)
```

### POS — Mesas
```
GET    /api/pos/tables           → Listar mesas
POST   /api/pos/tables           → Crear mesa
PUT    /api/pos/tables/:id       → Editar mesa / cambiar estado
DELETE /api/pos/tables/:id       → Eliminar mesa
```

### POS — Pedidos
```
GET    /api/pos/orders           → Listar pedidos (filtros: status, fecha, mesa)
POST   /api/pos/orders           → Crear pedido (asignar mesa + items)
PUT    /api/pos/orders/:id       → Actualizar pedido (agregar items, cambiar status)
DELETE /api/pos/orders/:id       → Cancelar pedido
GET    /api/pos/orders/:id       → Detalle de pedido
POST   /api/pos/orders/:id/items → Agregar items al pedido
PUT    /api/pos/orders/:id/items/:itemId → Modificar item (cantidad, notas)
DELETE /api/pos/orders/:id/items/:itemId → Quitar item
```

### POS — Cocina (WebSocket + REST)
```
GET    /api/pos/kitchen          → Comandas pendientes
PUT    /api/pos/kitchen/:id      → Actualizar status de comanda
WS     /ws/kitchen               → Tiempo real: nuevas comandas, items listos
```

### POS — Pagos y Tickets
```
POST   /api/pos/payments         → Registrar pago de un pedido
GET    /api/pos/payments         → Historial de pagos
GET    /api/pos/tickets/:id      → Generar / ver ticket
POST   /api/pos/tickets/:id/print → Imprimir ticket
```

### POS — Caja
```
POST   /api/pos/cash-register/open   → Abrir caja (monto inicial)
POST   /api/pos/cash-register/close  → Cerrar caja (corte)
GET    /api/pos/cash-register/current → Estado actual de la caja
GET    /api/pos/cash-register/history → Historial de cortes
```

### POS — Inventario
```
GET    /api/pos/inventory            → Listar inventario
POST   /api/pos/inventory            → Agregar producto al inventario
PUT    /api/pos/inventory/:id        → Editar producto
POST   /api/pos/inventory/:id/movement → Registrar movimiento (entrada, salida, merma)
GET    /api/pos/inventory/:id/history  → Historial de movimientos
GET    /api/pos/inventory/alerts      → Alertas de stock bajo
```

### POS — Reportes
```
GET    /api/pos/reports/sales        → Ventas por periodo
GET    /api/pos/reports/products     → Productos más vendidos
GET    /api/pos/reports/waiters      → Ventas por mesero
GET    /api/pos/reports/hours        → Horas pico
```

### Público (sin auth, resuelto por subdominio)
```
GET    /public/menu              → Menú digital del tenant
GET    /public/appointments/slots → Horarios disponibles
POST   /public/appointments      → Agendar cita
GET    /public/page/:slug        → Página pública
```

---

## Seguridad

- [x] Passwords con bcrypt (salt rounds: 12)
- [x] JWT access token (15 min) + refresh token (7 días, rotación)
- [x] Middleware de tenant isolation en CADA query Prisma
- [x] Validación de inputs con Zod
- [x] Rate limiting por IP (express-rate-limit)
- [x] Helmet.js para headers de seguridad
- [x] CORS configurado por dominio
- [x] Sanitización contra XSS
- [x] Protección CSRF en formularios
- [x] HTTPS forzado vía Cloudflare

---

## Resolución de Subdominios

1. DNS wildcard: `*.tudominio.com → Cloudflare Tunnel`
2. Middleware Express extrae el subdominio del `Host` header
3. Busca el tenant por `slug` en la BD
4. Inyecta `tenantId` en `req.tenant`
5. Si no existe → 404 personalizado

---

## Cloudflare Tunnel

1. Instalar `cloudflared` en el servidor
2. Crear tunnel: `cloudflared tunnel create saas-platform`
3. Configurar DNS wildcard apuntando al tunnel
4. Config `config.yml` enrutando `*.tudominio.com` al backend local
5. Ejecutar como servicio del sistema

---

## Estructura de Carpetas

```
/
├── backend/
│   ├── src/
│   │   ├── config/              → DB, env, cloudflare, websocket
│   │   ├── middleware/           → auth, tenant, validation, rateLimit
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── tenant.ts
│   │   │   ├── services.ts
│   │   │   ├── menu.ts
│   │   │   ├── appointments.ts   ← Sergio
│   │   │   ├── pos/
│   │   │   │   ├── tables.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── kitchen.ts
│   │   │   │   ├── payments.ts
│   │   │   │   ├── cashRegister.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   └── reports.ts
│   │   │   └── public.ts
│   │   ├── controllers/          → lógica por recurso
│   │   ├── services/             → lógica de negocio
│   │   ├── websocket/            → Socket.io (cocina en tiempo real)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── utils/                → helpers, ticket generator
│   │   └── app.ts                → entrada Express + Socket.io
│   ├── package.json
│   └── tsconfig.json
│
├── web/                          → Frontend Web
│   ├── src/
│   │   ├── pages/                → dashboard, login, register, POS, menú
│   │   ├── components/           → UI reutilizable
│   │   ├── hooks/                → useAuth, useTenant, useSocket
│   │   ├── api/                  → cliente HTTP
│   │   ├── public-views/         → vistas públicas (menú, citas)
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── mobile/                       → APK (React Native)
│   ├── src/
│   │   ├── screens/              → Login, Dashboard, Menú, Citas, POS
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/                  → misma lógica que web
│   │   └── App.tsx
│   ├── android/
│   ├── ios/
│   └── package.json
│
├── desktop/                      → POS Desktop (.exe)
│   ├── src/
│   │   ├── main/                 → Electron main process
│   │   ├── renderer/             → React (comparte con web)
│   │   │   ├── pages/            → POS, Cocina, Caja, Inventario
│   │   │   ├── components/
│   │   │   └── App.tsx
│   │   └── preload.ts
│   ├── package.json
│   └── electron-builder.yml
│
├── shared/                       → Código compartido entre plataformas
│   ├── types/                    → Interfaces TypeScript
│   ├── validators/               → Schemas Zod (cliente y servidor)
│   └── constants/
│
├── PLAN.md
└── docker-compose.yml            → PostgreSQL + Redis (cache/sessions)
```

---

## Fases de Desarrollo

> ⚠️ **Primero TODO el backend, después las apps (web, mobile, desktop).**

### Fase 1 — Base del Backend
- [ ] Setup backend Express + TypeScript
- [ ] Prisma schema completo + migraciones
- [ ] Docker Compose (PostgreSQL + Redis)
- [ ] Auth unificado (register, login, JWT, refresh)
- [ ] Middleware de tenant isolation
- [ ] Resolución de subdominios
- [ ] Setup WebSocket (Socket.io)

### Fase 2 — Módulo Menú Digital (Tú)
- [ ] CRUD Categorías (routes, controllers, services)
- [ ] CRUD Items del menú
- [ ] Endpoints públicos del menú por subdominio

### Fase 3 — Módulo Agenda de Citas (Sergio)
- [ ] CRUD Appointments (routes, controllers, services)
- [ ] Configuración de AvailableSlots
- [ ] Endpoints públicos de citas por subdominio
- [ ] Validación de slots disponibles (no duplicar citas)

### Fase 4 — Módulo POS (Tú)
- [ ] CRUD Mesas (estados, zonas)
- [ ] CRUD Pedidos (crear, agregar items, cambiar status)
- [ ] Sistema de cocina con WebSocket (comandas en tiempo real)
- [ ] Pagos (efectivo, tarjeta, transferencia)
- [ ] Generación de tickets / recibos
- [ ] Apertura y corte de caja
- [ ] Inventario (stock, movimientos, alertas de stock bajo)
- [ ] Reportes (ventas, productos top, meseros, horas pico)

### Fase 5 — Infraestructura
- [ ] Cloudflare Tunnel setup
- [ ] Wildcard DNS
- [ ] NGINX config
- [ ] Variables de entorno producción
- [ ] Rate limiting, helmet, CORS
- [ ] Manejo de errores global + logs

### Fase 6 — Frontend Web
- [ ] Setup React + Vite
- [ ] Login / Register unificado
- [ ] Panel admin (dashboard, gestión de servicios)
- [ ] Vista pública: Menú Digital
- [ ] Vista pública: Agenda de Citas
- [ ] POS Web (pedidos, mesas, cocina, caja)

### Fase 7 — Mobile (APK)
- [ ] Setup React Native
- [ ] Login unificado (misma API)
- [ ] Vista de menú digital (cliente escanea QR)
- [ ] Agenda de citas desde el móvil
- [ ] POS móvil (meseros toman pedidos desde el celular)
- [ ] Notificaciones push

### Fase 8 — Desktop POS (.exe)
- [ ] Setup Electron + React
- [ ] POS completo: mesas, pedidos, cocina, caja
- [ ] Impresión de tickets (ESC/POS para impresoras térmicas)
- [ ] Inventario y reportes
- [ ] Modo offline (sincroniza cuando vuelve la conexión)
- [ ] Build para Windows (.exe)

---

## Comandos Clave

```bash
# Levantar BD local
docker-compose up -d

# Migraciones
npx prisma migrate dev

# Seed
npx prisma db seed

# Backend dev
cd backend && npm run dev

# Web frontend dev
cd web && npm run dev

# Mobile dev
cd mobile && npx react-native start

# Desktop dev
cd desktop && npm run dev

# Build .exe
cd desktop && npm run build

# Cloudflare tunnel
cloudflared tunnel run saas-platform
```
