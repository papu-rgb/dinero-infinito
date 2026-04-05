import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Iniciando seed de datos de prueba...\n');

  // 1. Crear tenant de prueba
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'barberia-demo' },
    update: {},
    create: {
      slug: 'barberia-demo',
      name: 'Barbería Demo',
      plan: 'FREE',
    },
  });
  console.log(`✅ Tenant creado: ${tenant.name} (${tenant.id})`);

  // 2. Crear usuario dueño
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@barberia-demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@barberia-demo.com',
      passwordHash: '$2b$12$placeholder.hash', // placeholder
      name: 'Admin Demo',
      role: 'OWNER',
    },
  });
  console.log(`✅ Usuario creado: ${user.email}`);

  // 3. Crear servicio de tipo APPOINTMENT
  const service = await prisma.service.upsert({
    where: { tenantId_type: { tenantId: tenant.id, type: 'APPOINTMENT' } },
    update: {},
    create: {
      tenantId: tenant.id,
      type: 'APPOINTMENT',
      active: true,
    },
  });
  console.log(`✅ Servicio APPOINTMENT creado (${service.id})`);

  // 4. Crear tipos de servicio
  const types = [
    { name: 'Corte de cabello', description: 'Corte clásico o moderno', duration: 30, price: 150, order: 1 },
    { name: 'Corte + Barba', description: 'Corte de cabello y arreglo de barba', duration: 45, price: 200, order: 2 },
    { name: 'Barba', description: 'Arreglo y perfilado de barba', duration: 15, price: 80, order: 3 },
    { name: 'Tratamiento capilar', description: 'Tratamiento hidratante o keratina', duration: 60, price: 350, order: 4 },
  ];

  const createdTypes = [];
  for (const type of types) {
    const created = await prisma.appointmentType.create({
      data: {
        tenantId: tenant.id,
        serviceId: service.id,
        ...type,
      },
    });
    createdTypes.push(created);
    console.log(`   📋 Tipo: ${created.name} (${created.duration}min, $${created.price})`);
  }
  console.log(`✅ ${types.length} tipos de servicio creados`);

  // 5. Crear horarios disponibles (Lunes a Viernes, 9am-1pm y 3pm-6pm)
  const daysOfWeek = [
    { day: 1, name: 'Lunes' },
    { day: 2, name: 'Martes' },
    { day: 3, name: 'Miércoles' },
    { day: 4, name: 'Jueves' },
    { day: 5, name: 'Viernes' },
    { day: 6, name: 'Sábado' },
  ];

  for (const { day, name } of daysOfWeek) {
    // Turno mañana
    await prisma.availableSlot.create({
      data: {
        tenantId: tenant.id,
        serviceId: service.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '13:00',
      },
    });

    // Turno tarde (excepto sábado que es solo mañana)
    if (day !== 6) {
      await prisma.availableSlot.create({
        data: {
          tenantId: tenant.id,
          serviceId: service.id,
          dayOfWeek: day,
          startTime: '15:00',
          endTime: '18:00',
        },
      });
      console.log(`   📅 ${name}: 09:00-13:00, 15:00-18:00`);
    } else {
      console.log(`   📅 ${name}: 09:00-13:00`);
    }
  }
  console.log(`✅ Horarios configurados (L-V mañana y tarde, Sáb solo mañana)`);

  // 6. Crear algunas citas de ejemplo
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Asegurar que no caiga en domingo
  if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  if (nextWeek.getDay() === 0) nextWeek.setDate(nextWeek.getDate() + 1);

  const appointments = [
    {
      appointmentTypeId: createdTypes[0].id, // Corte
      clientName: 'Juan Pérez',
      clientPhone: '5512345678',
      clientEmail: 'juan@email.com',
      date: tomorrow,
      time: '09:00',
      status: 'PENDING' as const,
    },
    {
      appointmentTypeId: createdTypes[1].id, // Corte + Barba
      clientName: 'Carlos García',
      clientPhone: '5587654321',
      date: tomorrow,
      time: '10:00',
      status: 'CONFIRMED' as const,
    },
    {
      appointmentTypeId: createdTypes[2].id, // Barba
      clientName: 'Pedro Martínez',
      clientPhone: '5511223344',
      date: nextWeek,
      time: '15:00',
      status: 'PENDING' as const,
    },
  ];

  for (const appt of appointments) {
    await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        serviceId: service.id,
        ...appt,
      },
    });
    console.log(`   📌 Cita: ${appt.clientName} - ${appt.time} (${appt.status})`);
  }
  console.log(`✅ ${appointments.length} citas de ejemplo creadas`);

  // 7. Bloquear un día festivo de ejemplo
  const blockedDate = new Date(today);
  blockedDate.setDate(blockedDate.getDate() + 14); // 2 semanas
  await prisma.blockedDate.create({
    data: {
      tenantId: tenant.id,
      serviceId: service.id,
      date: blockedDate,
      reason: 'Día festivo — ejemplo',
    },
  });
  console.log(`✅ Fecha bloqueada: ${blockedDate.toISOString().split('T')[0]} (Día festivo)`);

  console.log('\n🎉 Seed completado exitosamente!');
  console.log(`\n📋 Resumen:`);
  console.log(`   Tenant: ${tenant.name} (slug: ${tenant.slug})`);
  console.log(`   Tenant ID: ${tenant.id}`);
  console.log(`   Tipos de servicio: ${types.length}`);
  console.log(`   Horarios configurados: ${daysOfWeek.length * 2 - 1}`);
  console.log(`   Citas de ejemplo: ${appointments.length}`);
  console.log(`   Fechas bloqueadas: 1`);
}

seed()
  .catch((error) => {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
