import { PrismaClient, AppointmentStatus } from '@prisma/client';
import type {
  CreateAppointmentTypeInput,
  UpdateAppointmentTypeInput,
  CreateAppointmentPublicInput,
  UpdateAppointmentInput,
  UpdateStatusInput,
  CreateSlotInput,
  UpdateSlotInput,
  BlockDateInput,
  ListAppointmentsQuery,
} from '../validators/appointments.validator';

const prisma = new PrismaClient();

// ==================== ERRORES PERSONALIZADOS ====================

export class AppointmentError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AppointmentError';
  }
}

// ==================== TRANSICIONES DE ESTADO ====================

const VALID_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  CONFIRMED: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
  CANCELLED: [], // estado final
  COMPLETED: [], // estado final
  NO_SHOW: [],   // estado final
};

// ==================== APPOINTMENT TYPES ====================

export async function getAppointmentTypes(tenantId: string) {
  return prisma.appointmentType.findMany({
    where: { tenantId },
    orderBy: { order: 'asc' },
  });
}

export async function getAppointmentTypeById(tenantId: string, id: string) {
  const type = await prisma.appointmentType.findFirst({
    where: { id, tenantId },
  });

  if (!type) {
    throw new AppointmentError('APPOINTMENT_TYPE_NOT_FOUND', 'Tipo de servicio no encontrado', 404);
  }

  return type;
}

export async function createAppointmentType(tenantId: string, data: CreateAppointmentTypeInput) {
  // Buscar el servicio de tipo APPOINTMENT del tenant
  const service = await getOrCreateAppointmentService(tenantId);

  return prisma.appointmentType.create({
    data: {
      tenantId,
      serviceId: service.id,
      name: data.name,
      description: data.description,
      duration: data.duration,
      price: data.price,
      order: data.order ?? 0,
    },
  });
}

export async function updateAppointmentType(tenantId: string, id: string, data: UpdateAppointmentTypeInput) {
  // Verificar que existe y pertenece al tenant
  await getAppointmentTypeById(tenantId, id);

  return prisma.appointmentType.update({
    where: { id },
    data,
  });
}

export async function deleteAppointmentType(tenantId: string, id: string) {
  // Verificar que existe y pertenece al tenant
  await getAppointmentTypeById(tenantId, id);

  // Soft delete: desactivar en vez de eliminar
  return prisma.appointmentType.update({
    where: { id },
    data: { active: false },
  });
}

// ==================== AVAILABLE SLOTS ====================

export async function getAvailableSlots(tenantId: string) {
  return prisma.availableSlot.findMany({
    where: { tenantId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

export async function createAvailableSlot(tenantId: string, data: CreateSlotInput) {
  const service = await getOrCreateAppointmentService(tenantId);

  return prisma.availableSlot.create({
    data: {
      tenantId,
      serviceId: service.id,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
    },
  });
}

export async function updateAvailableSlot(tenantId: string, id: string, data: UpdateSlotInput) {
  const slot = await prisma.availableSlot.findFirst({
    where: { id, tenantId },
  });

  if (!slot) {
    throw new AppointmentError('SLOT_NOT_FOUND', 'Horario no encontrado', 404);
  }

  return prisma.availableSlot.update({
    where: { id },
    data,
  });
}

export async function deleteAvailableSlot(tenantId: string, id: string) {
  const slot = await prisma.availableSlot.findFirst({
    where: { id, tenantId },
  });

  if (!slot) {
    throw new AppointmentError('SLOT_NOT_FOUND', 'Horario no encontrado', 404);
  }

  return prisma.availableSlot.delete({
    where: { id },
  });
}

// ==================== BLOCKED DATES ====================

export async function getBlockedDates(tenantId: string) {
  return prisma.blockedDate.findMany({
    where: { tenantId },
    orderBy: { date: 'asc' },
  });
}

export async function createBlockedDate(tenantId: string, data: BlockDateInput) {
  const service = await getOrCreateAppointmentService(tenantId);

  return prisma.blockedDate.create({
    data: {
      tenantId,
      serviceId: service.id,
      date: new Date(data.date),
      reason: data.reason,
    },
  });
}

export async function deleteBlockedDate(tenantId: string, id: string) {
  const blockedDate = await prisma.blockedDate.findFirst({
    where: { id, tenantId },
  });

  if (!blockedDate) {
    throw new AppointmentError('BLOCKED_DATE_NOT_FOUND', 'Fecha bloqueada no encontrada', 404);
  }

  return prisma.blockedDate.delete({
    where: { id },
  });
}

// ==================== APPOINTMENTS ====================

export async function listAppointments(tenantId: string, query: ListAppointmentsQuery) {
  const { date, dateFrom, dateTo, status, page, limit } = query;
  const skip = (page - 1) * limit;

  // Construir filtros dinámicamente
  const where: any = { tenantId };

  if (date) {
    const dateStart = new Date(date);
    const dateEnd = new Date(date);
    dateEnd.setDate(dateEnd.getDate() + 1);
    where.date = { gte: dateStart, lt: dateEnd };
  } else if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      where.date.lt = end;
    }
  }

  if (status) {
    where.status = status;
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: { appointmentType: true },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    appointments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAppointmentById(tenantId: string, id: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id, tenantId },
    include: { appointmentType: true },
  });

  if (!appointment) {
    throw new AppointmentError('APPOINTMENT_NOT_FOUND', 'Cita no encontrada', 404);
  }

  return appointment;
}

export async function createAppointment(tenantId: string, data: CreateAppointmentPublicInput) {
  // 1. Verificar que el tipo de servicio existe y está activo
  const appointmentType = await prisma.appointmentType.findFirst({
    where: { id: data.appointmentTypeId, tenantId },
  });

  if (!appointmentType) {
    throw new AppointmentError('APPOINTMENT_TYPE_NOT_FOUND', 'Tipo de servicio no encontrado', 404);
  }

  if (!appointmentType.active) {
    throw new AppointmentError('APPOINTMENT_TYPE_INACTIVE', 'Tipo de servicio no está activo', 400);
  }

  // 2. Verificar que la fecha no es pasada
  const requestedDate = new Date(data.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (requestedDate < today) {
    throw new AppointmentError('PAST_DATE', 'No se puede agendar en fecha pasada', 400);
  }

  // 3. Verificar que la fecha no está bloqueada
  const isBlocked = await prisma.blockedDate.findFirst({
    where: {
      tenantId,
      date: requestedDate,
    },
  });

  if (isBlocked) {
    throw new AppointmentError('DATE_BLOCKED', `La fecha está bloqueada: ${isBlocked.reason || 'No disponible'}`, 400);
  }

  // 4. Verificar que el slot está disponible (usando transacción para evitar race conditions)
  return prisma.$transaction(async (tx) => {
    // Verificar que hay slots configurados para ese día
    const dayOfWeek = requestedDate.getDay();
    const configuredSlots = await tx.availableSlot.findMany({
      where: {
        tenantId,
        dayOfWeek,
        active: true,
      },
    });

    if (configuredSlots.length === 0) {
      throw new AppointmentError('NO_SLOTS_CONFIGURED', 'No hay horarios configurados para ese día', 400);
    }

    // Verificar que la hora solicitada cae dentro de algún slot configurado
    const timeInSlot = configuredSlots.some(
      (slot) => data.time >= slot.startTime && data.time < slot.endTime
    );

    if (!timeInSlot) {
      throw new AppointmentError('SLOT_NOT_AVAILABLE', 'El horario seleccionado no está dentro del horario de atención', 400);
    }

    // Verificar que no hay cita que se solape con el horario solicitado
    const existingAppointments = await tx.appointment.findMany({
      where: {
        tenantId,
        date: requestedDate,
        status: { notIn: [AppointmentStatus.CANCELLED] },
      },
      include: { appointmentType: true },
    });

    const requestedStart = timeToMinutes(data.time);
    const requestedEnd = requestedStart + appointmentType.duration;

    for (const existing of existingAppointments) {
      const existingStart = timeToMinutes(existing.time);
      const existingEnd = existingStart + existing.appointmentType.duration;

      // Verificar solapamiento
      if (requestedStart < existingEnd && requestedEnd > existingStart) {
        throw new AppointmentError('SLOT_NOT_AVAILABLE', 'El horario seleccionado ya no está disponible', 400);
      }
    }

    // 5. Crear la cita
    return tx.appointment.create({
      data: {
        tenantId,
        serviceId: appointmentType.serviceId,
        appointmentTypeId: data.appointmentTypeId,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || undefined,
        date: requestedDate,
        time: data.time,
        notes: data.notes,
      },
      include: { appointmentType: true },
    });
  });
}

export async function updateAppointment(tenantId: string, id: string, data: UpdateAppointmentInput) {
  // Verificar que existe
  await getAppointmentById(tenantId, id);

  const updateData: any = { ...data };

  // Si cambia la fecha, convertirla
  if (data.date) {
    updateData.date = new Date(data.date);
  }

  return prisma.appointment.update({
    where: { id },
    data: updateData,
    include: { appointmentType: true },
  });
}

export async function updateAppointmentStatus(tenantId: string, id: string, data: UpdateStatusInput) {
  const appointment = await getAppointmentById(tenantId, id);

  // Verificar transición válida
  const allowedTransitions = VALID_STATUS_TRANSITIONS[appointment.status];
  const newStatus = data.status as AppointmentStatus;

  if (!allowedTransitions.includes(newStatus)) {
    throw new AppointmentError(
      'INVALID_STATUS_TRANSITION',
      `No se puede cambiar de ${appointment.status} a ${data.status}. Transiciones permitidas: ${allowedTransitions.join(', ') || 'ninguna (estado final)'}`,
      400
    );
  }

  return prisma.appointment.update({
    where: { id },
    data: {
      status: newStatus,
      notes: data.notes ?? appointment.notes,
    },
    include: { appointmentType: true },
  });
}

export async function deleteAppointment(tenantId: string, id: string) {
  // Verificar que existe
  await getAppointmentById(tenantId, id);

  // Cancelar en vez de eliminar
  return prisma.appointment.update({
    where: { id },
    data: { status: AppointmentStatus.CANCELLED },
    include: { appointmentType: true },
  });
}

// ==================== CÁLCULO DE SLOTS DISPONIBLES (PÚBLICO) ====================

export async function calculateAvailableSlots(
  tenantId: string,
  date: string,
  appointmentTypeId: string
) {
  // 1. Obtener el tipo de servicio y su duración
  const appointmentType = await prisma.appointmentType.findFirst({
    where: { id: appointmentTypeId, tenantId, active: true },
  });

  if (!appointmentType) {
    throw new AppointmentError('APPOINTMENT_TYPE_NOT_FOUND', 'Tipo de servicio no encontrado o inactivo', 404);
  }

  const duration = appointmentType.duration;
  const requestedDate = new Date(date);

  // 2. Verificar que no es fecha pasada
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (requestedDate < today) {
    throw new AppointmentError('PAST_DATE', 'No se puede consultar disponibilidad en fecha pasada', 400);
  }

  // 3. Verificar que la fecha no está bloqueada
  const isBlocked = await prisma.blockedDate.findFirst({
    where: {
      tenantId,
      date: requestedDate,
    },
  });

  if (isBlocked) {
    throw new AppointmentError('DATE_BLOCKED', `La fecha está bloqueada: ${isBlocked.reason || 'No disponible'}`, 400);
  }

  // 4. Obtener los slots configurados para ese día de la semana
  const dayOfWeek = requestedDate.getDay();
  const configuredSlots = await prisma.availableSlot.findMany({
    where: {
      tenantId,
      dayOfWeek,
      active: true,
    },
    orderBy: { startTime: 'asc' },
  });

  if (configuredSlots.length === 0) {
    throw new AppointmentError('NO_SLOTS_CONFIGURED', 'No hay horarios configurados para ese día', 400);
  }

  // 5. Obtener citas existentes para esa fecha (no canceladas)
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      date: requestedDate,
      status: { notIn: [AppointmentStatus.CANCELLED] },
    },
    include: { appointmentType: true },
  });

  // 6. Generar todos los slots posibles según la duración del tipo seleccionado
  const allSlots: string[] = [];

  for (const configuredSlot of configuredSlots) {
    const startMinutes = timeToMinutes(configuredSlot.startTime);
    const endMinutes = timeToMinutes(configuredSlot.endTime);

    // Generar slots desde startTime hasta endTime en incrementos de la duración
    for (let current = startMinutes; current + duration <= endMinutes; current += duration) {
      allSlots.push(minutesToTime(current));
    }
  }

  // 7. Filtrar slots que se solapan con citas existentes
  const availableSlots = allSlots.filter((slotTime) => {
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + duration;

    // Verificar que no se solapa con ninguna cita existente
    for (const existing of existingAppointments) {
      const existingStart = timeToMinutes(existing.time);
      const existingEnd = existingStart + existing.appointmentType.duration;

      // Hay solapamiento si: slotStart < existingEnd AND slotEnd > existingStart
      if (slotStart < existingEnd && slotEnd > existingStart) {
        return false;
      }
    }

    return true;
  });

  // 8. Si es hoy, filtrar los slots que ya pasaron
  const now = new Date();
  const isToday = requestedDate.toDateString() === now.toDateString();

  const filteredSlots = isToday
    ? availableSlots.filter((time) => {
        const [hours, minutes] = time.split(':').map(Number);
        const slotDate = new Date(requestedDate);
        slotDate.setHours(hours, minutes, 0, 0);
        return slotDate > now;
      })
    : availableSlots;

  return {
    date,
    dayOfWeek,
    appointmentType: {
      id: appointmentType.id,
      name: appointmentType.name,
      duration: appointmentType.duration,
      price: appointmentType.price,
    },
    slots: filteredSlots,
    totalAvailable: filteredSlots.length,
  };
}

// ==================== PUBLIC: GET TYPES ====================

export async function getPublicAppointmentTypes(tenantId: string) {
  return prisma.appointmentType.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      price: true,
      order: true,
    },
    orderBy: { order: 'asc' },
  });
}

// ==================== PUBLIC: GET APPOINTMENT STATUS ====================

export async function getPublicAppointmentStatus(tenantId: string, id: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      clientName: true,
      date: true,
      time: true,
      status: true,
      appointmentType: {
        select: {
          name: true,
          duration: true,
        },
      },
      createdAt: true,
    },
  });

  if (!appointment) {
    throw new AppointmentError('APPOINTMENT_NOT_FOUND', 'Cita no encontrada', 404);
  }

  return appointment;
}

// ==================== HELPERS ====================

/** Convierte "HH:mm" a minutos desde medianoche */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Convierte minutos desde medianoche a "HH:mm" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Obtener o crear el servicio de tipo APPOINTMENT para el tenant */
async function getOrCreateAppointmentService(tenantId: string) {
  let service = await prisma.service.findFirst({
    where: { tenantId, type: 'APPOINTMENT' },
  });

  if (!service) {
    service = await prisma.service.create({
      data: {
        tenantId,
        type: 'APPOINTMENT',
        active: true,
      },
    });
  }

  return service;
}
