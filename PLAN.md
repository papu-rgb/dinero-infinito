# Plan - Plataforma SaaS Multi-Tenant

## Visión General
Plataforma donde clientes se registran, eligen un servicio (menú digital, agenda de citas, etc.) y automáticamente obtienen su propia página web bajo un subdominio (`cliente.tudominio.com`).

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React (Vite) |
| Backend | Node.js + Express |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Auth | JWT + bcrypt (refresh tokens) |
| Tunnel | Cloudflare Tunnel |
| Subdominios | Wildcard DNS + middleware de resolución de tenant |

---

## Arquitectura

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
  - id, tenantId, email, passwordHash, role (OWNER, ADMIN, STAFF), createdAt

- **RefreshToken** — Tokens de sesión
  - id, userId, token, expiresAt

### Tablas de Servicios

- **Service** — Tipo de servicio activo por tenant
  - id, tenantId, type (MENU_DIGITAL, APPOINTMENT, LANDING), config (JSON), active

- **MenuItem** — Para menús digitales
  - id, tenantId, serviceId, name, description, price, image, category, order, active

- **MenuCategory** — Categorías del menú
  - id, tenantId, serviceId, name, order

- **Appointment** — Para agenda de citas
  - id, tenantId, serviceId, clientName, clientPhone, clientEmail, date, time, status, notes

- **AvailableSlot** — Horarios disponibles
  - id, tenantId, serviceId, dayOfWeek, startTime, endTime, active

- **Page** — Páginas personalizadas / landing
  - id, tenantId, serviceId, title, content (JSON/HTML), slug, published

---

## API - Endpoints Principales

### Auth
```
POST   /api/auth/register       → Crear cuenta + tenant
POST   /api/auth/login           → Login, devuelve JWT
POST   /api/auth/refresh         → Refresh token
POST   /api/auth/logout          → Invalidar token
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

### Citas
```
GET    /api/appointments         → Listar citas (admin)
POST   /api/appointments         → Agendar cita (público)
PUT    /api/appointments/:id     → Actualizar estado
DELETE /api/appointments/:id     → Cancelar cita
GET    /api/appointments/slots   → Horarios disponibles (público)
POST   /api/appointments/slots   → Configurar horarios (admin)
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
│   │   ├── config/          → DB, env, cloudflare
│   │   ├── middleware/       → auth, tenant, validation, rateLimit
│   │   ├── routes/          → auth, tenant, menu, appointments, public
│   │   ├── controllers/     → lógica por recurso
│   │   ├── services/        → lógica de negocio
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── utils/           → helpers
│   │   └── app.ts           → entrada Express
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/           → dashboard, login, register, servicios
│   │   ├── components/      → UI reutilizable
│   │   ├── hooks/           → useAuth, useTenant
│   │   ├── api/             → cliente HTTP
│   │   ├── public-views/    → vistas públicas (menú, citas)
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── PLAN.md
└── docker-compose.yml       → PostgreSQL local
```

---

## Fases de Desarrollo

### Fase 1 — Base
- [ ] Setup backend Express + TypeScript
- [ ] Prisma schema + migraciones
- [ ] Docker Compose para PostgreSQL
- [ ] Auth (register, login, JWT, refresh)
- [ ] Middleware de tenant isolation
- [ ] Resolución de subdominios

### Fase 2 — Servicios
- [ ] CRUD Menú Digital (categorías + items)
- [ ] Sistema de Citas (slots + agendamiento)
- [ ] Vistas públicas por subdominio

### Fase 3 — Frontend
- [ ] Setup React + Vite
- [ ] Panel admin (dashboard, gestión de servicios)
- [ ] Vistas públicas responsive (menú, agenda)
- [ ] Login / Register

### Fase 4 — Infraestructura
- [ ] Cloudflare Tunnel setup
- [ ] Wildcard DNS
- [ ] NGINX config
- [ ] Variables de entorno producción

### Fase 5 — Pulido
- [ ] Rate limiting, helmet, CORS
- [ ] Manejo de errores global
- [ ] Logs
- [ ] Tests básicos

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

# Frontend dev
cd frontend && npm run dev

# Cloudflare tunnel
cloudflared tunnel run saas-platform
```
