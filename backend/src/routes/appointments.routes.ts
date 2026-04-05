import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import * as ctrl from '../controllers/appointments.controller';

// ==================== ADMIN ROUTES ====================
// Prefijo: /api/appointments
// Requieren: auth + tenant

const adminRouter = Router();

// Middleware: todas las rutas admin requieren tenant + auth
adminRouter.use(tenantMiddleware);
adminRouter.use(authMiddleware);

// --- Tipos de servicio ---
adminRouter.get('/types', ctrl.getTypes);
adminRouter.get('/types/:id', ctrl.getTypeById);
adminRouter.post('/types', ctrl.createType);
adminRouter.put('/types/:id', ctrl.updateType);
adminRouter.delete('/types/:id', ctrl.deleteType);

// --- Horarios disponibles ---
adminRouter.get('/slots', ctrl.getSlots);
adminRouter.post('/slots', ctrl.createSlot);
adminRouter.put('/slots/:id', ctrl.updateSlot);
adminRouter.delete('/slots/:id', ctrl.deleteSlot);

// --- Fechas bloqueadas ---
adminRouter.get('/blocked', ctrl.getBlockedDates);
adminRouter.post('/blocked', ctrl.createBlockedDate);
adminRouter.delete('/blocked/:id', ctrl.deleteBlockedDate);

// --- Citas ---
adminRouter.get('/', ctrl.listAppointments);
adminRouter.get('/:id', ctrl.getAppointmentById);
adminRouter.post('/', ctrl.createAppointmentAdmin);
adminRouter.put('/:id', ctrl.updateAppointment);
adminRouter.delete('/:id', ctrl.deleteAppointment);

// ==================== PUBLIC ROUTES ====================
// Prefijo: /public/appointments
// Requieren: solo tenant (resuelto por subdominio)

const publicRouter = Router();

// Middleware: solo tenant (NO auth)
publicRouter.use(tenantMiddleware);

// --- Tipos de servicio (público) ---
publicRouter.get('/types', ctrl.publicGetTypes);

// --- Consultar slots disponibles ---
publicRouter.get('/slots', ctrl.publicGetSlots);

// --- Agendar cita ---
publicRouter.post('/', ctrl.publicCreateAppointment);

// --- Consultar estado de una cita ---
publicRouter.get('/:id/status', ctrl.publicGetStatus);

// ==================== EXPORT ====================

export const appointmentsAdminRouter = adminRouter;
export const appointmentsPublicRouter = publicRouter;
