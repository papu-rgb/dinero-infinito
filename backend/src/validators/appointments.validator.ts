import { z } from 'zod';

// ==================== APPOINTMENT TYPE ====================

export const createAppointmentTypeSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(5, 'Duración mínima: 5 minutos').max(480, 'Duración máxima: 8 horas'),
  price: z.number().min(0, 'El precio no puede ser negativo').optional(),
  order: z.number().int().min(0).optional(),
});

export const updateAppointmentTypeSchema = createAppointmentTypeSchema.partial();

// ==================== APPOINTMENT (Público) ====================

export const createAppointmentPublicSchema = z.object({
  appointmentTypeId: z.string().min(1, 'El tipo de servicio es requerido'),
  clientName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  clientPhone: z.string().min(8, 'Teléfono inválido').max(20),
  clientEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora: HH:mm'),
  notes: z.string().max(500).optional(),
});

// ==================== APPOINTMENT (Admin) ====================

export const createAppointmentAdminSchema = createAppointmentPublicSchema;

export const updateAppointmentSchema = z.object({
  clientName: z.string().min(2).max(100).optional(),
  clientPhone: z.string().min(8).max(20).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
});

// ==================== STATUS ====================

export const updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'], {
    errorMap: () => ({ message: 'Estado inválido. Valores permitidos: CONFIRMED, CANCELLED, COMPLETED, NO_SHOW' })
  }),
  notes: z.string().max(500).optional(),
});

// ==================== AVAILABLE SLOT ====================

export const createSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0, 'dayOfWeek: 0-6 (Domingo-Sábado)').max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato: HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato: HH:mm'),
}).refine(data => data.startTime < data.endTime, {
  message: 'startTime debe ser anterior a endTime',
  path: ['endTime'],
});

export const updateSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  active: z.boolean().optional(),
});

// ==================== BLOCKED DATE ====================

export const blockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: YYYY-MM-DD'),
  reason: z.string().max(200).optional(),
});

// ==================== QUERY PARAMS (Listado) ====================

export const listAppointmentsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== PUBLIC QUERY ====================

export const publicSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: YYYY-MM-DD'),
  appointmentTypeId: z.string().min(1, 'appointmentTypeId es requerido'),
});

// ==================== TIPOS EXPORTADOS ====================

export type CreateAppointmentTypeInput = z.infer<typeof createAppointmentTypeSchema>;
export type UpdateAppointmentTypeInput = z.infer<typeof updateAppointmentTypeSchema>;
export type CreateAppointmentPublicInput = z.infer<typeof createAppointmentPublicSchema>;
export type CreateAppointmentAdminInput = z.infer<typeof createAppointmentAdminSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
export type BlockDateInput = z.infer<typeof blockDateSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type PublicSlotsQuery = z.infer<typeof publicSlotsQuerySchema>;
