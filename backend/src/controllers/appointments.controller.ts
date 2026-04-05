import { Request, Response } from 'express';
import * as appointmentsService from '../services/appointments.service';
import { AppointmentError } from '../services/appointments.service';
import {
  createAppointmentTypeSchema,
  updateAppointmentTypeSchema,
  createAppointmentPublicSchema,
  createAppointmentAdminSchema,
  updateAppointmentSchema,
  updateStatusSchema,
  createSlotSchema,
  updateSlotSchema,
  blockDateSchema,
  listAppointmentsQuerySchema,
  publicSlotsQuerySchema,
} from '../validators/appointments.validator';
import { ZodError } from 'zod';

// ==================== HELPER ====================

function handleError(res: Response, error: unknown) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  if (error instanceof AppointmentError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  console.error('Error inesperado:', error);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  });
}

function getTenantId(req: Request): string {
  return req.tenant?.id || '';
}

// ==================== APPOINTMENT TYPES (Admin) ====================

export async function getTypes(req: Request, res: Response) {
  try {
    const types = await appointmentsService.getAppointmentTypes(getTenantId(req));
    res.json({ success: true, data: types });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getTypeById(req: Request, res: Response) {
  try {
    const type = await appointmentsService.getAppointmentTypeById(getTenantId(req), req.params.id);
    res.json({ success: true, data: type });
  } catch (error) {
    handleError(res, error);
  }
}

export async function createType(req: Request, res: Response) {
  try {
    const data = createAppointmentTypeSchema.parse(req.body);
    const type = await appointmentsService.createAppointmentType(getTenantId(req), data);
    res.status(201).json({ success: true, data: type });
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateType(req: Request, res: Response) {
  try {
    const data = updateAppointmentTypeSchema.parse(req.body);
    const type = await appointmentsService.updateAppointmentType(getTenantId(req), req.params.id, data);
    res.json({ success: true, data: type });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteType(req: Request, res: Response) {
  try {
    const type = await appointmentsService.deleteAppointmentType(getTenantId(req), req.params.id);
    res.json({ success: true, data: type, message: 'Tipo de servicio desactivado' });
  } catch (error) {
    handleError(res, error);
  }
}

// ==================== AVAILABLE SLOTS (Admin) ====================

export async function getSlots(req: Request, res: Response) {
  try {
    const slots = await appointmentsService.getAvailableSlots(getTenantId(req));
    res.json({ success: true, data: slots });
  } catch (error) {
    handleError(res, error);
  }
}

export async function createSlot(req: Request, res: Response) {
  try {
    const data = createSlotSchema.parse(req.body);
    const slot = await appointmentsService.createAvailableSlot(getTenantId(req), data);
    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateSlot(req: Request, res: Response) {
  try {
    const data = updateSlotSchema.parse(req.body);
    const slot = await appointmentsService.updateAvailableSlot(getTenantId(req), req.params.id, data);
    res.json({ success: true, data: slot });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteSlot(req: Request, res: Response) {
  try {
    const slot = await appointmentsService.deleteAvailableSlot(getTenantId(req), req.params.id);
    res.json({ success: true, data: slot, message: 'Horario eliminado' });
  } catch (error) {
    handleError(res, error);
  }
}

// ==================== BLOCKED DATES (Admin) ====================

export async function getBlockedDates(req: Request, res: Response) {
  try {
    const dates = await appointmentsService.getBlockedDates(getTenantId(req));
    res.json({ success: true, data: dates });
  } catch (error) {
    handleError(res, error);
  }
}

export async function createBlockedDate(req: Request, res: Response) {
  try {
    const data = blockDateSchema.parse(req.body);
    const blockedDate = await appointmentsService.createBlockedDate(getTenantId(req), data);
    res.status(201).json({ success: true, data: blockedDate });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteBlockedDate(req: Request, res: Response) {
  try {
    const date = await appointmentsService.deleteBlockedDate(getTenantId(req), req.params.id);
    res.json({ success: true, data: date, message: 'Fecha desbloqueada' });
  } catch (error) {
    handleError(res, error);
  }
}

// ==================== APPOINTMENTS (Admin) ====================

export async function listAppointments(req: Request, res: Response) {
  try {
    const query = listAppointmentsQuerySchema.parse(req.query);
    const result = await appointmentsService.listAppointments(getTenantId(req), query);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getAppointmentById(req: Request, res: Response) {
  try {
    const appointment = await appointmentsService.getAppointmentById(getTenantId(req), req.params.id);
    res.json({ success: true, data: appointment });
  } catch (error) {
    handleError(res, error);
  }
}

export async function createAppointmentAdmin(req: Request, res: Response) {
  try {
    const data = createAppointmentAdminSchema.parse(req.body);
    const appointment = await appointmentsService.createAppointment(getTenantId(req), data);
    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateAppointment(req: Request, res: Response) {
  try {
    // Si tiene campo 'status', usar updateStatus
    if (req.body.status && Object.keys(req.body).length <= 2) {
      const data = updateStatusSchema.parse(req.body);
      const appointment = await appointmentsService.updateAppointmentStatus(getTenantId(req), req.params.id, data);
      return res.json({ success: true, data: appointment });
    }

    // Si no, actualizar otros campos
    const data = updateAppointmentSchema.parse(req.body);
    const appointment = await appointmentsService.updateAppointment(getTenantId(req), req.params.id, data);
    res.json({ success: true, data: appointment });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteAppointment(req: Request, res: Response) {
  try {
    const appointment = await appointmentsService.deleteAppointment(getTenantId(req), req.params.id);
    res.json({ success: true, data: appointment, message: 'Cita cancelada' });
  } catch (error) {
    handleError(res, error);
  }
}

// ==================== PUBLIC ENDPOINTS ====================

export async function publicGetTypes(req: Request, res: Response) {
  try {
    const types = await appointmentsService.getPublicAppointmentTypes(getTenantId(req));
    res.json({ success: true, data: types });
  } catch (error) {
    handleError(res, error);
  }
}

export async function publicGetSlots(req: Request, res: Response) {
  try {
    const query = publicSlotsQuerySchema.parse(req.query);
    const result = await appointmentsService.calculateAvailableSlots(
      getTenantId(req),
      query.date,
      query.appointmentTypeId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
}

export async function publicCreateAppointment(req: Request, res: Response) {
  try {
    const data = createAppointmentPublicSchema.parse(req.body);
    const appointment = await appointmentsService.createAppointment(getTenantId(req), data);
    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    handleError(res, error);
  }
}

export async function publicGetStatus(req: Request, res: Response) {
  try {
    const appointment = await appointmentsService.getPublicAppointmentStatus(getTenantId(req), req.params.id);
    res.json({ success: true, data: appointment });
  } catch (error) {
    handleError(res, error);
  }
}
