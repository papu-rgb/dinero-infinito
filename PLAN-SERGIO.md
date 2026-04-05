# Plan Sergio — Backend Agenda de Citas

## Tu Responsabilidad

Eres responsable de construir **completamente** el módulo de **Agenda de Citas** del backend. Este módulo forma parte de una plataforma SaaS multi-tenant donde cada negocio (tenant) tiene su propio subdominio y puede activar servicios como menú digital, agenda de citas, etc.

Tu trabajo es TODO el backend de citas: modelos, rutas, controladores, servicios, validaciones y endpoints públicos.

---

## Contexto del Proyecto

### Stack que DEBES usar

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js |
| Framework | Express |
| Lenguaje | TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Validación | Zod |
| Auth | JWT (ya existirá middleware de auth) |

### Modelo Multi-Tenant

- Base de datos compartida, schema compartido
- **CADA tabla** tiene un campo `tenantId`
- **CADA query** se filtra por `tenantId` — NUNCA hagas un query sin filtrar por tenant
- El `tenantId` lo obtienes de `req.tenant.id` (lo inyecta un middleware que ya existe)

---

## Modelos de Base de Datos (Prisma)

Estos son los modelos que debes crear en el schema de Prisma:

### AppointmentType (Tipos de servicio que ofrece el negocio)

Cada negocio define qué servicios ofrece ("Corte de cabello", "Consulta general", etc.) con su duración y precio.

```prisma
model AppointmentType {
  id          String   @id @default(uuid())
  tenantId    String
  serviceId   String
  name        String        // "Corte de cabello", "Consulta general", "Limpieza dental"
  description String?
  duration    Int           // duración en minutos (30, 45, 60...)
  price       Decimal?      // precio opcional, para mostrar en la landing
  active      Boolean  @default(true)
  order       Int      @default(0) // para ordenar en la lista pública
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  service      Service       @relation(fields: [serviceId], references: [id])
  appointments Appointment[]

  @@index([tenantId])
  @@index([tenantId, active])
}
```

### Appointment (Citas)

```prisma
model Appointment {
  id                String   @id @default(uuid())
  tenantId          String
  serviceId         String
  appointmentTypeId String
  clientName        String
  clientPhone       String
  clientEmail       String?
  date              DateTime
  time              String
  status            AppointmentStatus @default(PENDING)
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  tenant          Tenant          @relation(fields: [tenantId], references: [id])
  service         Service         @relation(fields: [serviceId], references: [id])
  appointmentType AppointmentType @relation(fields: [appointmentTypeId], references: [id])

  @@index([tenantId])
  @@index([tenantId, date])
  @@index([tenantId, status])
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}
```

> **NOTA:** La duración de la cita se obtiene del `AppointmentType` relacionado, NO se guarda directo en Appointment.

### AvailableSlot (Horarios Disponibles)

```prisma
model AvailableSlot {
  id         String  @id @default(uuid())
  tenantId   String
  serviceId  String
  dayOfWeek  Int     // 0=Domingo, 1=Lunes, ..., 6=Sábado
  startTime  String  // formato "HH:mm" (24h)
  endTime    String  // formato "HH:mm" (24h)
  active     Boolean @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant     Tenant  @relation(fields: [tenantId], references: [id])
  service    Service @relation(fields: [serviceId], references: [id])

  @@index([tenantId])
  @@index([tenantId, dayOfWeek])
}
```

### BlockedDate (Días bloqueados — vacaciones, feriados, etc.)

```prisma
model BlockedDate {
  id        String   @id @default(uuid())
  tenantId  String
  serviceId String
  date      DateTime
  reason    String?
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  service   Service  @relation(fields: [serviceId], references: [id])

  @@index([tenantId])
  @@index([tenantId, date])
}
```

---

## Endpoints que DEBES implementar

### Rutas Admin (requieren auth + tenantId)

Prefijo: `/api/appointments`

```
GET    /api/appointments              → Listar citas del tenant (con filtros)
GET    /api/appointments/:id          → Detalle de una cita
POST   /api/appointments              → Crear cita manualmente (admin)
PUT    /api/appointments/:id          → Actualizar cita (cambiar estado, notas, reagendar)
DELETE /api/appointments/:id          → Cancelar/eliminar cita

GET    /api/appointments/slots        → Listar horarios configurados
POST   /api/appointments/slots        → Crear horario disponible
PUT    /api/appointments/slots/:id    → Editar horario
DELETE /api/appointments/slots/:id    → Eliminar horario

GET    /api/appointments/blocked      → Listar fechas bloqueadas
POST   /api/appointments/blocked      → Bloquear una fecha
DELETE /api/appointments/blocked/:id  → Desbloquear fecha

GET    /api/appointments/types        → Listar tipos de servicio
POST   /api/appointments/types        → Crear tipo de servicio
PUT    /api/appointments/types/:id    → Editar tipo de servicio
DELETE /api/appointments/types/:id    → Desactivar tipo de servicio
```

### Rutas Públicas (NO requieren auth, se resuelven por subdominio)

Prefijo: `/public`

```
GET    /public/appointments/types      → Listar tipos de servicio disponibles (nombre, duración, precio)
GET    /public/appointments/slots      → Horarios disponibles para una fecha y tipo de servicio
POST   /public/appointments            → Agendar cita (cliente final)
GET    /public/appointments/:id/status  → Consultar estado de una cita
```

---

## Lógica de Negocio IMPORTANTE

### 1. Calcular Slots Disponibles para una Fecha

Cuando un cliente quiere agendar cita, necesita ver los horarios disponibles para un día específico y un tipo de servicio:

1. Recibir `date` (ej: "2026-04-15") y `appointmentTypeId`
2. Obtener la `duration` del `AppointmentType` seleccionado
3. Determinar qué día de la semana es (ej: martes = 2)
4. Buscar los `AvailableSlot` del tenant para ese `dayOfWeek`
5. Verificar que la fecha NO esté en `BlockedDate`
6. Obtener las citas ya agendadas para esa fecha (status != CANCELLED) — cada una con la duración de su AppointmentType
7. Generar los slots individuales según la duración del tipo seleccionado
8. Filtrar los que se solapan con citas existentes (considerando la duración de CADA cita)
9. Retornar solo los disponibles

**Ejemplo:**
- AppointmentType: "Corte de cabello", duración 30 min
- AvailableSlot: Martes 09:00-13:00
- Genera: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30
- Ya hay cita a las 10:00 con duración 30min → se elimina 10:00
- Resultado: [09:00, 09:30, 10:30, 11:00, 11:30, 12:00, 12:30]

**Ejemplo con duración larga:**
- AppointmentType: "Consulta + tratamiento", duración 60 min
- AvailableSlot: Martes 09:00-13:00
- Genera: 09:00, 10:00, 11:00, 12:00
- Ya hay cita a las 10:00 (30min) → se elimina 10:00 (y 09:30 si existiera, porque se solaparía)
- Resultado: [09:00, 11:00, 12:00]

### 2. Agendar Cita (Público)

1. Validar inputs con Zod (nombre, teléfono, fecha, hora, appointmentTypeId)
2. Verificar que el `AppointmentType` existe y está activo
3. Verificar que el slot solicitado realmente está disponible (usando la duración del tipo, prevenir race conditions)
4. Verificar que la fecha no está bloqueada
5. Crear la cita con status `PENDING`
6. Retornar la cita creada con un ID para consultar estado

### 3. Actualizar Estado (Admin)

Estados válidos y transiciones:
```
PENDING → CONFIRMED | CANCELLED
CONFIRMED → COMPLETED | CANCELLED | NO_SHOW
CANCELLED → (estado final)
COMPLETED → (estado final)
NO_SHOW → (estado final)
```

No permitir transiciones inválidas (ej: de COMPLETED a PENDING).

### 4. Filtros para Listar Citas (Admin)

El admin debe poder filtrar por:
- `date` — fecha específica
- `dateFrom` / `dateTo` — rango de fechas
- `status` — estado de la cita
- Paginación: `page` + `limit`
- Ordenar por fecha (ascendente por defecto)

---

## Validaciones con Zod

### Crear/Editar Tipo de Servicio (admin)
```typescript
const createAppointmentTypeSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(5).max(480), // 5 min a 8 horas
  price: z.number().min(0).optional(),
  order: z.number().int().min(0).optional(),
});
```

### Crear Cita (público)
```typescript
const createAppointmentPublicSchema = z.object({
  appointmentTypeId: z.string().uuid(),
  clientName: z.string().min(2).max(100),
  clientPhone: z.string().min(8).max(20),
  clientEmail: z.string().email().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/),         // HH:mm
  notes: z.string().max(500).optional(),
});
```

### Crear/Editar Slot (admin)
```typescript
const createSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine(data => data.startTime < data.endTime, {
  message: "startTime debe ser anterior a endTime",
});
```

### Actualizar Estado (admin)
```typescript
const updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  notes: z.string().max(500).optional(),
});
```

### Bloquear Fecha (admin)
```typescript
const blockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});
```

---

## Estructura de Archivos que Debes Crear

```
backend/src/
├── routes/
│   └── appointments.routes.ts      → Definición de rutas
├── controllers/
│   └── appointments.controller.ts  → Manejo de req/res
├── services/
│   └── appointments.service.ts     → Lógica de negocio (aquí va lo pesado)
├── validators/
│   └── appointments.validator.ts   → Schemas de Zod
└── prisma/
    └── schema.prisma               → Agregar modelos AppointmentType, Appointment, AvailableSlot, BlockedDate
```

---

## Respuestas de la API

### Formato estándar de respuesta exitosa:
```json
{
  "success": true,
  "data": { ... }
}
```

### Formato estándar de error:
```json
{
  "success": false,
  "error": {
    "code": "SLOT_NOT_AVAILABLE",
    "message": "El horario seleccionado ya no está disponible"
  }
}
```

### Códigos de error específicos de citas:
| Código | Descripción |
|--------|-------------|
| `SLOT_NOT_AVAILABLE` | El horario ya fue tomado |
| `DATE_BLOCKED` | La fecha está bloqueada |
| `INVALID_STATUS_TRANSITION` | Transición de estado no válida |
| `APPOINTMENT_NOT_FOUND` | Cita no encontrada |
| `SLOT_NOT_FOUND` | Slot no encontrado |
| `NO_SLOTS_CONFIGURED` | No hay horarios configurados para ese día |
| `PAST_DATE` | No se puede agendar en fecha pasada |
| `APPOINTMENT_TYPE_NOT_FOUND` | Tipo de servicio no encontrado |
| `APPOINTMENT_TYPE_INACTIVE` | Tipo de servicio no está activo |

---

## Reglas y Consideraciones

1. **SIEMPRE** filtra por `tenantId` — NUNCA olvides esto
2. No permitas agendar en fechas pasadas
3. No permitas agendar en fechas bloqueadas
4. Valida que el slot esté realmente disponible antes de crear la cita
5. Usa transacciones de Prisma cuando crees una cita (para evitar race conditions)
6. Los horarios son en formato 24h ("09:00", "14:30")
7. Los días de la semana: 0=Domingo, 1=Lunes, ..., 6=Sábado
8. Maneja errores con try/catch y responde con el formato estándar
9. Las rutas públicas NO llevan middleware de auth, pero SÍ el middleware de tenant (se resuelve por subdominio)
10. Las rutas admin llevan AMBOS middlewares: auth + tenant

---

## Ejemplo de Flujo Completo

### Admin crea tipos de servicio:
```
POST /api/appointments/types
Body: { "name": "Corte de cabello", "duration": 30, "price": 150 }
→ Tipo creado con id "type-001"

POST /api/appointments/types
Body: { "name": "Corte + Barba", "duration": 45, "price": 200 }
→ Tipo creado con id "type-002"

POST /api/appointments/types
Body: { "name": "Barba", "duration": 15, "price": 80 }
→ Tipo creado con id "type-003"
```

### Admin configura horarios:
```
POST /api/appointments/slots
Body: { "dayOfWeek": 1, "startTime": "09:00", "endTime": "13:00" }
→ Lunes de 9am a 1pm

POST /api/appointments/slots
Body: { "dayOfWeek": 1, "startTime": "15:00", "endTime": "18:00" }
→ Lunes de 3pm a 6pm
```

### Admin bloquea un día:
```
POST /api/appointments/blocked
Body: { "date": "2026-04-20", "reason": "Día festivo" }
```

### Cliente ve los servicios disponibles:
```
GET /public/appointments/types
→ Respuesta: [
    { "id": "type-001", "name": "Corte de cabello", "duration": 30, "price": 150 },
    { "id": "type-002", "name": "Corte + Barba", "duration": 45, "price": 200 },
    { "id": "type-003", "name": "Barba", "duration": 15, "price": 80 }
  ]
```

### Cliente consulta disponibilidad para un tipo:
```
GET /public/appointments/slots?date=2026-04-21&appointmentTypeId=type-001
→ Respuesta: { "slots": ["09:00","09:30","10:00",...,"17:30"], "duration": 30 }
```

### Cliente agenda cita:
```
POST /public/appointments
Body: {
  "appointmentTypeId": "type-001",
  "clientName": "María López",
  "clientPhone": "5512345678",
  "date": "2026-04-21",
  "time": "10:00"
}
→ Respuesta: { "id": "abc123", "status": "PENDING", "type": "Corte de cabello", ... }
```

### Admin confirma la cita:
```
PUT /api/appointments/abc123
Body: { "status": "CONFIRMED" }
```

---

## Dependencias que Necesitas

```bash
# Ya deberían estar instaladas en el proyecto, pero verifica:
npm install express prisma @prisma/client zod
npm install -D typescript @types/express @types/node
```

---

## Checklist

- [x] Modelos Prisma (AppointmentType, Appointment, AvailableSlot, BlockedDate)
- [x] Migración de base de datos
- [x] Validators con Zod
- [x] Service: lógica de cálculo de slots disponibles
- [x] Service: lógica de agendamiento con validaciones
- [x] Service: lógica de transiciones de estado
- [x] Controller: endpoints admin de citas
- [x] Controller: endpoints admin de slots
- [x] Controller: endpoints admin de fechas bloqueadas
- [x] Controller: endpoints admin de tipos de servicio (CRUD)
- [x] Controller: endpoints públicos (listar tipos, consultar slots, agendar, consultar estado)
- [x] Routes: registrar todas las rutas
- [x] Manejo de errores con códigos específicos
- [x] Filtros y paginación en listado de citas
- [x] Seed de datos de prueba (opcional pero útil)
