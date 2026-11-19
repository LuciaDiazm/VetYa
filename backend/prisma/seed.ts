// Datos de prueba para desarrollo y para la demo.
// Se ejecuta con: npm run db:seed
//
// Es incremental: completa solo lo que falta y no modifica ni borra lo que ya existe.
// Así se puede volver a correr cada vez que se agregan tablas nuevas.
//
// Usuarios de prueba (solo para desarrollo, no usar en producción):
//   martin.rodriguez@vetya.test / vetya-vet-2026 (ADMIN: el veterinario a cargo; en pantalla, Administración)
//   paula.ferreyra@vetya.test / vetya-veterinaria-2026 (VETERINARIO: atiende y carga la historia clínica)
//   natalia.ojeda@vetya.test    / vetya-recepcion-2026   (RECEPCION: turnos, clientes y cobros; no ve lo clínico)
//   duenio@vetya.test       / vetya-duenio-2026  (DUENIO: "Prueba Turnos", para probar Pedir turno y Mi cuenta)
//
// Todos los datos son ficticios: la clínica, el equipo, las opiniones y los teléfonos.
// Las fotos están en frontend/public/fotos (ver CREDITOS.md).

import { PrismaClient, type MedioPago } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---------- Clínica ficticia en el centro de Goya ----------
  const clinica =
    (await prisma.clinica.findUnique({ where: { id: 1 } })) ??
    (await prisma.clinica.create({
      data: {
        nombre: "Clínica Veterinaria VetYa",
        direccion: "Colón 800, Goya, Corrientes",
        telefono: "3777 000000",
        whatsapp: "5493777000000",
        email: "contacto@vetya.test",
        latitud: -29.1435,
        longitud: -59.2643,
        horasCancelacion: 24,
      },
    }));
  const clinicaId = clinica.id;

  if (!clinica.telefonoUrgencias) {
    await prisma.clinica.update({
      where: { id: clinicaId },
      data: { telefonoUrgencias: "5493777000000", horarioUrgencias: "Todos los días de 8 a 22 h" },
    });
  }

  // ---------- Horario cortado típico de Goya ----------
  if ((await prisma.horarioAtencion.count({ where: { clinicaId } })) === 0) {
    const franjas = [];
    for (let dia = 1; dia <= 5; dia++) {
      franjas.push({ clinicaId, diaSemana: dia, horaInicio: "09:00", horaFin: "12:30" });
      franjas.push({ clinicaId, diaSemana: dia, horaInicio: "17:00", horaFin: "20:30" });
    }
    franjas.push({ clinicaId, diaSemana: 6, horaInicio: "09:00", horaFin: "12:30" });
    await prisma.horarioAtencion.createMany({ data: franjas });
  }

  // ---------- Servicios (se crean si faltan y se les agrega la foto) ----------
  const DESCRIPCION_PELUQUERIA = "Solo perros chicos y medianos, con turno previo. Baño, secado, limpieza de oídos, corte de uñas y peinado.";
  const servicios = [
    { nombre: "Consulta y control", categoria: "CLINICA", duracionMin: 20, fotoUrl: "/fotos/analisis.webp", descripcion: "Examen físico general, orientación diagnóstica y controles de rutina." },
    { nombre: "Vacunación", categoria: "CLINICA", duracionMin: 15, fotoUrl: "/fotos/vacuna-gatito.webp", descripcion: "Plan de vacunación para perros y gatos, con registro en el carnet digital." },
    { nombre: "Desparasitación", categoria: "CLINICA", duracionMin: 15, fotoUrl: "/fotos/rottweiler-cachorro.webp", descripcion: "Desparasitación interna y externa." },
    { nombre: "Análisis de sangre y orina", categoria: "DIAGNOSTICO", duracionMin: 20, fotoUrl: "/fotos/analisis.webp", descripcion: "Extracción de muestras para análisis clínicos." },
    { nombre: "Electrocardiograma", categoria: "DIAGNOSTICO", duracionMin: 30, fotoUrl: "/fotos/analisis.webp", descripcion: "Estudio del corazón, por ejemplo antes de una cirugía o en mascotas mayores." },
    { nombre: "Ecografía", categoria: "DIAGNOSTICO", duracionMin: 30, fotoUrl: "/fotos/analisis.webp", descripcion: "Estudio por imágenes para detectar problemas a tiempo." },
    { nombre: "Castración / esterilización", categoria: "CIRUGIA", duracionMin: 120, reservableOnline: false, fotoUrl: "/fotos/cirugia.webp", descripcion: "Cirugía programada. Se coordina con la clínica." },
    { nombre: "Limpieza dental", categoria: "CIRUGIA", duracionMin: 60, reservableOnline: false, fotoUrl: "/fotos/limpieza-dental.webp", descripcion: "Eliminación de sarro y placa bacteriana." },
    { nombre: "Baño y peluquería", categoria: "ESTETICA", duracionMin: 90, fotoUrl: "/fotos/perro-toalla.webp", descripcion: DESCRIPCION_PELUQUERIA },
  ] as const;

  // La peluquería es solo para perros chicos y medianos: se corrige el texto si quedó el de antes.
  await prisma.servicio.updateMany({
    where: { clinicaId, nombre: "Baño y peluquería", descripcion: "Baño, secado, limpieza de oídos, corte de uñas y peinado." },
    data: { descripcion: DESCRIPCION_PELUQUERIA },
  });

  for (const s of servicios) {
    const existente = await prisma.servicio.findFirst({ where: { clinicaId, nombre: s.nombre } });
    if (!existente) {
      await prisma.servicio.create({ data: { clinicaId, ...s } });
    } else if (!existente.fotoUrl) {
      await prisma.servicio.update({ where: { id: existente.id }, data: { fotoUrl: s.fotoUrl } });
    }
  }

  // ---------- Precios de referencia (inventados; se ven solo en el panel, nunca en la web) ----------
  // Solo se ponen si el servicio todavía no tiene precio: si la clínica lo cambió, queda el suyo.
  const precios: Record<string, number> = {
    "Consulta y control": 18000,
    Vacunación: 22000,
    Desparasitación: 9000,
    "Análisis de sangre y orina": 35000,
    Electrocardiograma: 30000,
    Ecografía: 38000,
    "Castración / esterilización": 90000,
    "Limpieza dental": 70000,
    "Baño y peluquería": 25000,
  };
  for (const [nombre, precio] of Object.entries(precios)) {
    await prisma.servicio.updateMany({ where: { clinicaId, nombre, precioReferencia: null }, data: { precioReferencia: precio } });
  }

  // ---------- Preguntas frecuentes ----------
  // (18/11) Se sacó "¿Necesito crear una cuenta…?": el inicio ya lo explica debajo de los 3 pasos.
  // Y la de las vacunas ya no repite el aviso por WhatsApp (lo cuenta la franja de vacunas).
  // Solo se tocan tal como las dejó el seed; si la clínica las cambió, quedan como estén.
  await prisma.preguntaFrecuente.deleteMany({
    where: { clinicaId, pregunta: "¿Necesito crear una cuenta para sacar turno?" },
  });
  await prisma.preguntaFrecuente.updateMany({
    where: { clinicaId, respuesta: "Depende de la edad y la vacuna. En general los refuerzos son anuales; te avisamos por WhatsApp cuando le toca." },
    data: { respuesta: "Depende de la edad y la vacuna. En general, los refuerzos son una vez por año." },
  });
  if ((await prisma.preguntaFrecuente.count({ where: { clinicaId } })) === 0) {
    await prisma.preguntaFrecuente.createMany({
      data: [
        { clinicaId, orden: 1, pregunta: "¿Atienden urgencias?", respuesta: "Sí. Ante una urgencia comunicate directamente por teléfono o WhatsApp antes de venir." },
        { clinicaId, orden: 3, pregunta: "¿Cada cuánto hay que vacunar a mi mascota?", respuesta: "Depende de la edad y la vacuna. En general, los refuerzos son una vez por año." },
        { clinicaId, orden: 4, pregunta: "¿Qué tengo que hacer antes de una castración?", respuesta: "La mascota debe venir con 8 a 12 horas de ayuno. Te damos las indicaciones al confirmar el turno." },
        { clinicaId, orden: 5, pregunta: "¿Puedo cancelar un turno?", respuesta: "Sí, con al menos 24 horas de anticipación desde la web o por WhatsApp." },
      ],
    });
  }

  // ---------- Usuarios y equipo ----------

  // Dueño de prueba, para recorrer Pedir turno y Mi cuenta sin crear cuentas a mano.
  // Arranca sin mascotas (la carga en el paso 4 del turno, como un cliente nuevo).
  if (!(await prisma.usuario.findUnique({ where: { email: "duenio@vetya.test" } }))) {
    const duenio = await prisma.usuario.create({
      data: {
        clinicaId,
        nombre: "Prueba",
        apellido: "Turnos",
        email: "duenio@vetya.test",
        telefono: "5493777000099",
        passwordHash: await bcrypt.hash("vetya-duenio-2026", 10),
        rol: "DUENIO",
      },
    });
    await prisma.cliente.create({
      data: {
        clinicaId,
        usuarioId: duenio.id,
        nombre: "Prueba",
        apellido: "Turnos",
        telefono: "5493777000099",
        email: "duenio@vetya.test",
      },
    });
  }

  // En noviembre el veterinario de ejemplo pasó de "Martín Sosa" a "Martín Rodríguez": se corrige si quedó el viejo.
  await prisma.usuario.updateMany({
    where: { email: "martin.sosa@vetya.test" },
    data: { apellido: "Rodríguez", email: "martin.rodriguez@vetya.test" },
  });
  const martin = await prisma.usuario.upsert({
    where: { email: "martin.rodriguez@vetya.test" },
    update: { rol: "ADMIN" },
    create: {
      clinicaId,
      nombre: "Martín",
      apellido: "Rodríguez",
      email: "martin.rodriguez@vetya.test",
      passwordHash: await bcrypt.hash("vetya-vet-2026", 10),
      rol: "ADMIN",
      visibleEnWeb: true,
      matricula: "M.P. 0002",
      especialidad: "Clínica, cirugía y ecografías",
      presentacion: "Atiendo las consultas, las cirugías programadas y las ecografías. Me sigo capacitando para cuidar mejor a cada paciente.",
    },
  });

  // (19/11) La clínica de ejemplo tiene un solo veterinario, que también la administra: una sola cuenta.
  // Lo que habían hecho las dos cuentas de ejemplo anteriores (consultas, turnos, avisos, pagos) pasa a Martín y
  // esas dos cuentas se borran. Así la historia clínica no pierde nada.
  await prisma.usuario.updateMany({
    where: { email: "martin.rodriguez@vetya.test", especialidad: "Cirugía y diagnóstico por imágenes" },
    data: {
      especialidad: "Clínica, cirugía y ecografías",
      presentacion: "Atiendo las consultas, las cirugías programadas y las ecografías. Me sigo capacitando para cuidar mejor a cada paciente.",
    },
  });
  const sobran = await prisma.usuario.findMany({
    where: { email: { in: ["admin@vetya.test", "veterinario@vetya.test"] } },
    select: { id: true },
  });
  if (sobran.length > 0) {
    const ids = sobran.map((u) => u.id);
    await prisma.$transaction([
      prisma.consulta.updateMany({ where: { veterinarioId: { in: ids } }, data: { veterinarioId: martin.id } }),
      prisma.turno.updateMany({ where: { veterinarioId: { in: ids } }, data: { veterinarioId: martin.id } }),
      prisma.recordatorio.updateMany({ where: { usuarioId: { in: ids } }, data: { usuarioId: martin.id } }),
      prisma.pago.updateMany({ where: { registradoPorId: { in: ids } }, data: { registradoPorId: martin.id } }),
      prisma.pago.updateMany({ where: { anuladoPorId: { in: ids } }, data: { anuladoPorId: martin.id } }),
      prisma.usuario.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  // (19/11) Los tres perfiles del personal: Martín (administración), una veterinaria y una recepcionista.
  // Nombres inventados. No aparecen en la web hasta que la administración lo elija en Configuración.
  for (const p of [
    { nombre: "Paula", apellido: "Ferreyra", email: "paula.ferreyra@vetya.test", clave: "vetya-veterinaria-2026", rol: "VETERINARIO" as const, matricula: "M.P. 0003" },
    { nombre: "Natalia", apellido: "Ojeda", email: "natalia.ojeda@vetya.test", clave: "vetya-recepcion-2026", rol: "RECEPCION" as const, matricula: null },
  ]) {
    await prisma.usuario.upsert({
      where: { email: p.email },
      update: {},
      create: {
        clinicaId,
        nombre: p.nombre,
        apellido: p.apellido,
        email: p.email,
        passwordHash: await bcrypt.hash(p.clave, 10),
        rol: p.rol,
        visibleEnWeb: false,
        matricula: p.matricula,
      },
    });
  }

  // Foto de cada profesional, solo si todavía no tiene una (si la clínica subió otra, se respeta).
  for (const [email, fotoUrl] of [
    ["martin.rodriguez@vetya.test", "/fotos/equipo-martin.webp"],
  ]) {
    await prisma.usuario.updateMany({ where: { email, fotoUrl: null }, data: { fotoUrl } });
  }

  // Las fotos de ejemplo se cambiaron en noviembre: se actualizan las rutas viejas que hayan quedado guardadas.
  const fotosViejas: Record<string, string> = {
    "/fotos/gatito-control.jpg": "/fotos/analisis.webp",
    "/fotos/vacunacion.jpg": "/fotos/vacuna-gatito.webp",
    "/fotos/gato-consulta.jpg": "/fotos/analisis.webp",
    "/fotos/perro-doctor.jpg": "/fotos/analisis.webp",
    "/fotos/ecografia.jpg": "/fotos/analisis.webp",
    "/fotos/cirugia.jpg": "/fotos/cirugia.webp",
    "/fotos/dental.jpg": "/fotos/limpieza-dental.webp",
    "/fotos/peluqueria.jpg": "/fotos/perro-toalla.webp",
    "/fotos/cachorro.jpg": "/fotos/rottweiler-cachorro.webp",
    "/fotos/gatito.jpg": "/fotos/gatito-vacuna.webp",
    // Nombres de una primera prueba que ya no están.
    "/fotos/revision-pata.webp": "/fotos/analisis.webp",
    "/fotos/manos-cachorro.webp": "/fotos/analisis.webp",
    "/fotos/dalmatas-durmiendo.webp": "/fotos/cirugia.webp",
    "/fotos/gatito-naranja.webp": "/fotos/gatito-vacuna.webp",
  };
  for (const [vieja, nueva] of Object.entries(fotosViejas)) {
    await prisma.servicio.updateMany({ where: { fotoUrl: vieja }, data: { fotoUrl: nueva } });
    await prisma.planSanitario.updateMany({ where: { fotoUrl: vieja }, data: { fotoUrl: nueva } });
  }
  // El plan cachorro y la desparasitación usaban la foto de un caniche: ahora usan la del rottweiler.
  await prisma.planSanitario.updateMany({
    where: { fotoUrl: "/fotos/caniche-blanco.webp" },
    data: { fotoUrl: "/fotos/rottweiler-cachorro.webp" },
  });
  await prisma.servicio.updateMany({
    where: { fotoUrl: "/fotos/caniche-blanco.webp" },
    data: { fotoUrl: "/fotos/rottweiler-cachorro.webp" },
  });

  // ---------- Opiniones de ejemplo (ficticias) ----------
  if ((await prisma.opinion.count({ where: { clinicaId } })) === 0) {
    await prisma.opinion.createMany({
      data: [
        { clinicaId, autor: "Carolina R.", mascota: "Lola", puntaje: 5, fecha: new Date("2026-08-14"), texto: "Me avisaron por WhatsApp que a Lola le tocaba la vacuna y saqué turno en un minuto. Muy atentos." },
        { clinicaId, autor: "Diego M.", mascota: "Tom", puntaje: 5, fecha: new Date("2026-09-02"), texto: "Castraron a Tom y nos explicaron todo antes y después. Se recuperó perfecto." },
        { clinicaId, autor: "Silvia A.", mascota: "Coco", puntaje: 4, fecha: new Date("2026-09-21"), texto: "Me gusta poder ver el carnet de vacunas desde el celular, ya no pierdo la libreta." },
      ],
    });
  }

  // ---------- Formas de pago ----------
  if ((await prisma.formaPago.count({ where: { clinicaId } })) === 0) {
    await prisma.formaPago.createMany({
      data: [
        { clinicaId, orden: 1, nombre: "Efectivo" },
        { clinicaId, orden: 2, nombre: "Transferencia bancaria", detalle: "Te pasamos el alias al confirmar el turno." },
        { clinicaId, orden: 3, nombre: "Mercado Pago", detalle: "Con QR en el mostrador o link de pago." },
        { clinicaId, orden: 4, nombre: "Tarjetas de débito y crédito" },
      ],
    });
  }

  // ---------- Planes sanitarios (calendarios orientativos; el veterinario los adapta) ----------
  if ((await prisma.planSanitario.count({ where: { clinicaId } })) === 0) {
    await prisma.planSanitario.create({
      data: {
        clinicaId,
        nombre: "Plan cachorro",
        especie: "PERRO",
        fotoUrl: "/fotos/rottweiler-cachorro.webp",
        descripcion: "Las vacunas y desparasitaciones del primer año, en el orden recomendado. Te avisamos por WhatsApp antes de cada una.",
        dosis: {
          create: [
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 2 },
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 4 },
            { tipo: "VACUNA", producto: "Primera dosis séxtuple", edadSemanas: 6 },
            { tipo: "VACUNA", producto: "Segunda dosis séxtuple", edadSemanas: 9 },
            { tipo: "VACUNA", producto: "Tercera dosis séxtuple", edadSemanas: 12 },
            { tipo: "VACUNA", producto: "Antirrábica", edadSemanas: 16, nota: "Obligatoria. Refuerzo anual." },
          ],
        },
      },
    });

    await prisma.planSanitario.create({
      data: {
        clinicaId,
        nombre: "Plan gatito",
        especie: "GATO",
        fotoUrl: "/fotos/gatito-vacuna.webp",
        descripcion: "Los controles del primer año de tu gato, para que crezca sano y protegido.",
        dosis: {
          create: [
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 3 },
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 6 },
            { tipo: "VACUNA", producto: "Primera dosis triple felina", edadSemanas: 8 },
            { tipo: "VACUNA", producto: "Segunda dosis triple felina", edadSemanas: 12 },
            { tipo: "VACUNA", producto: "Antirrábica", edadSemanas: 16, nota: "Obligatoria. Refuerzo anual." },
          ],
        },
      },
    });
  }

  // ---------- Promoción ----------
  if ((await prisma.promocion.count({ where: { clinicaId } })) === 0) {
    await prisma.promocion.create({
      data: {
        clinicaId,
        titulo: "10% de descuento en la primera consulta",
        descripcion: "Para mascotas que se atienden por primera vez en la clínica. Una mascota por consulta.",
        porcentajeDescuento: 10,
        soloPrimeraAtencion: true,
        vigenteDesde: new Date("2026-10-01"),
        vigenteHasta: new Date("2026-12-31"),
      },
    });
  }

  // ---------- Cliente sin cuenta con una vacuna por vencer (para probar recordatorios) ----------
  if ((await prisma.cliente.count({ where: { clinicaId } })) === 0) {
    const cliente = await prisma.cliente.create({
      data: {
        clinicaId,
        nombre: "Juan",
        apellido: "Pérez",
        telefono: "5493777111111",
        mascotas: {
          create: { nombre: "Firulais", especie: "PERRO", sexo: "MACHO", raza: "Mestizo", castrado: true },
        },
      },
      include: { mascotas: true },
    });

    const haceUnAnio = new Date();
    haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1);
    const enCincoDias = new Date();
    enCincoDias.setDate(enCincoDias.getDate() + 5);

    await prisma.consulta.create({
      data: {
        mascotaId: cliente.mascotas[0].id,
        veterinarioId: martin.id,
        fecha: haceUnAnio,
        motivo: "Control anual y vacunación",
        pesoKg: 18.5,
        diagnostico: "Buen estado general",
        aplicaciones: {
          create: {
            mascotaId: cliente.mascotas[0].id,
            tipo: "VACUNA",
            producto: "Antirrábica",
            fechaAplicacion: haceUnAnio,
            fechaProximaDosis: enCincoDias,
          },
        },
      },
    });
  }

  // ---------- Más clientes ficticios, para probar la búsqueda ----------
  const masClientes = [
    {
      nombre: "María", apellido: "Fernández", telefono: "5493777222333", dni: "30111222",
      mascotas: [
        { nombre: "Lola", especie: "PERRO", sexo: "HEMBRA", raza: "Mestiza", color: "Negro", castrado: true, fechaNacimiento: new Date("2021-03-10") },
        { nombre: "Simón", especie: "GATO", sexo: "MACHO", color: "Atigrado", castrado: true, fechaNacimiento: new Date("2023-07-01") },
      ],
    },
    {
      nombre: "Diego", apellido: "Martínez", telefono: "5493777444555",
      mascotas: [{ nombre: "Tom", especie: "PERRO", sexo: "MACHO", raza: "Mestizo", color: "Marrón", castrado: false, fechaNacimiento: new Date("2024-01-15") }],
    },
    {
      nombre: "Silvia", apellido: "Acosta", telefono: "5493777666777",
      mascotas: [{ nombre: "Coco", especie: "GATO", sexo: "HEMBRA", color: "Blanco", castrado: true, fechaNacimiento: new Date("2019-11-20") }],
    },
  ] as const;

  for (const { mascotas, ...c } of masClientes) {
    if (await prisma.cliente.findFirst({ where: { clinicaId, telefono: c.telefono } })) continue;
    await prisma.cliente.create({ data: { clinicaId, ...c, mascotas: { create: [...mascotas] } } });
  }

  // ---------- Historia de ejemplo, para que los recordatorios tengan casos en la demo ----------
  // Las fechas son relativas al día en que se corre el seed.
  const lola = await prisma.mascota.findFirst({ where: { nombre: "Lola", cliente: { clinicaId } } });
  const simon = await prisma.mascota.findFirst({ where: { nombre: "Simón", cliente: { clinicaId } } });
  if (lola && simon && (await prisma.consulta.count({ where: { mascotaId: { in: [lola.id, simon.id] } } })) === 0) {
    const fecha = (dias: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + dias);
      return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
    };
    // Lola: no viene hace 8 meses y tiene la séxtuple vencida hace 2 meses → "para recuperar".
    await prisma.consulta.create({
      data: {
        mascotaId: lola.id, veterinarioId: martin.id, fecha: fecha(-240), motivo: "Control y vacunación", pesoKg: 21.3,
        diagnostico: "Buen estado general",
        aplicaciones: { create: { mascotaId: lola.id, tipo: "VACUNA", producto: "Séxtuple", fechaAplicacion: fecha(-240), fechaProximaDosis: fecha(-60) } },
      },
    });
    // Simón: le toca la desparasitación en 3 días → "por vencer".
    await prisma.consulta.create({
      data: {
        mascotaId: simon.id, veterinarioId: martin.id, fecha: fecha(-87), motivo: "Desparasitación", pesoKg: 4.2,
        aplicaciones: { create: { mascotaId: simon.id, tipo: "DESPARASITACION", producto: "Desparasitación interna", fechaAplicacion: fecha(-87), fechaProximaDosis: fecha(3) } },
      },
    });
  }

  // ---------- Más casos para Notificaciones (17/11) ----------
  // Tres clientes para recuperar y tres dosis por vencer. Las fechas son relativas al día en que se
  // corre el seed; cada cliente se crea una sola vez (se reconoce por el teléfono).
  {
    const fecha = (dias: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + dias);
      return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
    };
    type Caso = {
      nombre: string; apellido: string; telefono: string;
      mascota: { nombre: string; especie: "PERRO" | "GATO"; sexo: "MACHO" | "HEMBRA"; raza?: string; color: string; castrado: boolean; fechaNacimiento: Date };
      visitaHace: number; pesoKg: number; motivo: string;
      dosis: { tipo: "VACUNA" | "DESPARASITACION"; producto: string; proximaEn: number };
    };
    const casos: Caso[] = [
      // Para recuperar: no vienen hace más de 6 meses y la dosis ya venció hace más de un mes.
      {
        nombre: "Roberto", apellido: "Giménez", telefono: "5493777301001",
        mascota: { nombre: "Rocky", especie: "PERRO", sexo: "MACHO", raza: "Mestizo", color: "Negro y fuego", castrado: true, fechaNacimiento: new Date("2018-05-02") },
        visitaHace: 230, pesoKg: 24.1, motivo: "Control y vacunación",
        dosis: { tipo: "VACUNA", producto: "Antirrábica", proximaEn: -50 },
      },
      {
        nombre: "Carmen", apellido: "López", telefono: "5493777301002",
        mascota: { nombre: "Mishi", especie: "GATO", sexo: "HEMBRA", color: "Gris", castrado: true, fechaNacimiento: new Date("2020-09-14") },
        visitaHace: 280, pesoKg: 3.8, motivo: "Vacunación anual",
        dosis: { tipo: "VACUNA", producto: "Triple felina", proximaEn: -90 },
      },
      {
        nombre: "Hugo", apellido: "Benítez", telefono: "5493777301003",
        mascota: { nombre: "Bruno", especie: "PERRO", sexo: "MACHO", raza: "Labrador", color: "Dorado", castrado: false, fechaNacimiento: new Date("2022-02-20") },
        visitaHace: 200, pesoKg: 30.5, motivo: "Desparasitación y control",
        dosis: { tipo: "DESPARASITACION", producto: "Desparasitación interna", proximaEn: -110 },
      },
      // Por vencer: la dosis toca en los próximos días (o venció hace poco).
      {
        nombre: "Ana", apellido: "Romero", telefono: "5493777302001",
        mascota: { nombre: "Luna", especie: "PERRO", sexo: "HEMBRA", raza: "Caniche", color: "Blanco", castrado: true, fechaNacimiento: new Date("2021-06-08") },
        visitaHace: 363, pesoKg: 6.2, motivo: "Vacunación anual",
        dosis: { tipo: "VACUNA", producto: "Antirrábica", proximaEn: 2 },
      },
      {
        nombre: "Pablo", apellido: "Torres", telefono: "5493777302002",
        mascota: { nombre: "Pelusa", especie: "GATO", sexo: "HEMBRA", color: "Tricolor", castrado: true, fechaNacimiento: new Date("2022-11-30") },
        visitaHace: 85, pesoKg: 4.0, motivo: "Desparasitación",
        dosis: { tipo: "DESPARASITACION", producto: "Desparasitación interna", proximaEn: 5 },
      },
      {
        nombre: "Graciela", apellido: "Ruiz", telefono: "5493777302003",
        mascota: { nombre: "Toby", especie: "PERRO", sexo: "MACHO", raza: "Beagle", color: "Tricolor", castrado: true, fechaNacimiento: new Date("2019-04-17") },
        visitaHace: 370, pesoKg: 13.4, motivo: "Control y vacunación",
        dosis: { tipo: "VACUNA", producto: "Séxtuple", proximaEn: -4 },
      },
    ];
    for (const c of casos) {
      if (await prisma.cliente.findFirst({ where: { clinicaId, telefono: c.telefono } })) continue;
      const cliente = await prisma.cliente.create({
        data: { clinicaId, nombre: c.nombre, apellido: c.apellido, telefono: c.telefono, mascotas: { create: c.mascota } },
        include: { mascotas: true },
      });
      const mascotaId = cliente.mascotas[0].id;
      await prisma.consulta.create({
        data: {
          mascotaId, veterinarioId: martin.id, fecha: fecha(-c.visitaHace), motivo: c.motivo, pesoKg: c.pesoKg,
          diagnostico: "Buen estado general",
          aplicaciones: {
            create: { mascotaId, tipo: c.dosis.tipo, producto: c.dosis.producto, fechaAplicacion: fecha(-c.visitaHace), fechaProximaDosis: fecha(c.dosis.proximaEn) },
          },
        },
      });
    }
  }

  // ---------- Historial de turnos de ejemplo (para la pantalla de estadísticas) ----------
  // Turnos ya pasados de los últimos 10 meses, con estados y orígenes variados. Solo se crean si
  // todavía no hay ningún turno pasado. No generan consultas, así no cambian los casos de los recordatorios.
  const inicioDeHoy = new Date(`${new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)}T03:00:00.000Z`);
  if ((await prisma.turno.count({ where: { clinicaId, fechaHoraInicio: { lt: inicioDeHoy } } })) === 0) {
    const nombres = ["Firulais", "Tom", "Coco"];
    const mascotasHistorial = await prisma.mascota.findMany({
      where: { nombre: { in: nombres }, cliente: { clinicaId } },
      include: { cliente: true },
    });
    const serviciosHistorial = await prisma.servicio.findMany({ where: { clinicaId, reservableOnline: true } });
    const veterinaria = martin;
    const horas = ["09:00", "09:45", "10:30", "11:15", "17:00", "17:45", "18:30", "19:15"];

    // Números "al azar" pero siempre iguales, para que la demo sea reproducible.
    let semilla = 20261012;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    const elegir = <T,>(lista: T[]) => lista[Math.floor(azar() * lista.length)];

    const turnos = [];
    for (let dias = 300; dias >= 1; dias--) {
      const dia = new Date(inicioDeHoy.getTime() - dias * 24 * 3600 * 1000);
      const diaSemana = new Date(dia.getTime() - 3 * 3600 * 1000).getUTCDay();
      if (diaSemana === 0) continue; // domingo cerrado
      // Lunes y viernes vienen más cargados; el sábado solo hay mañana.
      const cantidad = Math.floor(azar() * (diaSemana === 1 || diaSemana === 5 ? 5 : 3.5));
      const horasDelDia = diaSemana === 6 ? horas.slice(0, 4) : horas;
      const usadas = new Set<string>();
      for (let i = 0; i < cantidad && usadas.size < horasDelDia.length; i++) {
        let hora = elegir(horasDelDia);
        while (usadas.has(hora)) hora = elegir(horasDelDia);
        usadas.add(hora);
        const servicio = elegir(serviciosHistorial);
        const inicio = new Date(dia.getTime() + (Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))) * 60 * 1000);
        const r = azar();
        const o = azar();
        turnos.push({
          clinicaId,
          mascotaId: elegir(mascotasHistorial).id,
          servicioId: servicio.id,
          veterinarioId: veterinaria?.id ?? null,
          fechaHoraInicio: inicio,
          fechaHoraFin: new Date(inicio.getTime() + servicio.duracionMin * 60 * 1000),
          estado: r < 0.8 ? ("ATENDIDO" as const) : r < 0.92 ? ("AUSENTE" as const) : ("CANCELADO" as const),
          origen: o < 0.3 ? ("ONLINE" as const) : o < 0.8 ? ("TELEFONO" as const) : ("MOSTRADOR" as const),
          creadoEn: new Date(inicio.getTime() - Math.floor(1 + azar() * 6) * 24 * 3600 * 1000),
        });
      }
    }
    if (mascotasHistorial.length > 0 && serviciosHistorial.length > 0) {
      await prisma.turno.createMany({ data: turnos });

      // Avisos de "te extrañamos" de hace 3 meses, para el indicador de clientes recuperados.
      if (veterinaria) {
        for (const [i, m] of mascotasHistorial.entries()) {
          const enviado = new Date(inicioDeHoy.getTime() - (82 - i) * 24 * 3600 * 1000);
          await prisma.recordatorio.create({
            data: {
              clienteId: m.clienteId,
              usuarioId: veterinaria.id,
              tipo: "RECUPERO",
              mensaje: `Hola ${m.cliente.nombre}, hace mucho que no vemos a ${m.nombre}. ¿Le damos un turno para un control?`,
              enviadoEn: enviado,
            },
          });
        }
      }
    }
  }

  // ---------- Pagos de ejemplo (para la pantalla Pagos y los ingresos de Estadísticas) ----------
  // Solo si todavía no hay ningún pago. Se cobran los turnos atendidos hasta hace 3 días; los de los
  // últimos días quedan "Por cobrar" para mostrar cómo funciona. Más un par de ventas sin turno y un anulado.
  if ((await prisma.pago.count({ where: { clinicaId } })) === 0) {
    const quienCobra = martin;
    const hace3Dias = new Date(inicioDeHoy.getTime() - 3 * 24 * 3600 * 1000);
    const atendidos = await prisma.turno.findMany({
      where: { clinicaId, estado: "ATENDIDO", fechaHoraInicio: { lt: hace3Dias } },
      include: { servicio: true, mascota: true },
    });
    let semilla = 20261121;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    const medio = () => {
      const r = azar();
      return r < 0.45 ? ("EFECTIVO" as const) : r < 0.75 ? ("TRANSFERENCIA" as const) : r < 0.9 ? ("DEBITO" as const) : ("CREDITO" as const);
    };
    if (quienCobra && atendidos.length > 0) {
      type PagoEjemplo = {
        clinicaId: number;
        clienteId: number | null;
        turnoId: number | null;
        monto: number;
        medio: MedioPago;
        concepto: string;
        fecha: Date;
        registradoPorId: number;
      };
      const pagos: PagoEjemplo[] = atendidos.map((turno) => {
        // Uno de cada 20 fue un control sin cargo
        const sinCargo = azar() < 0.05;
        return {
          clinicaId,
          clienteId: turno.mascota.clienteId,
          turnoId: turno.id,
          monto: sinCargo ? 0 : Number(turno.servicio.precioReferencia ?? 15000),
          medio: sinCargo ? ("SIN_CARGO" as const) : medio(),
          concepto: `${turno.servicio.nombre} · ${turno.mascota.nombre}`,
          fecha: new Date(turno.fechaHoraFin.getTime() + 5 * 60 * 1000),
          registradoPorId: quienCobra.id,
        };
      });
      // Ventas en el mostrador, sin turno
      const juan = await prisma.cliente.findFirst({ where: { clinicaId, nombre: "Juan", apellido: "Pérez" } });
      for (const [dias, concepto, monto] of [
        [20, "Alimento balanceado 3 kg", 21000],
        [9, "Pipeta antipulgas", 8500],
      ] as const) {
        pagos.push({
          clinicaId,
          clienteId: juan?.id ?? null,
          turnoId: null,
          monto,
          medio: "EFECTIVO",
          concepto,
          fecha: new Date(inicioDeHoy.getTime() - dias * 24 * 3600 * 1000 + 14 * 3600 * 1000),
          registradoPorId: quienCobra.id,
        });
      }
      await prisma.pago.createMany({ data: pagos });

      // Un pago anulado (se cargó dos veces), para ver cómo queda registrado.
      const ultimo = pagos.filter((x) => x.turnoId).at(-1);
      if (ultimo) {
        await prisma.pago.create({
          data: {
            ...ultimo,
            fecha: new Date(ultimo.fecha.getTime() + 60 * 1000),
            anulado: true,
            anuladoEn: new Date(ultimo.fecha.getTime() + 10 * 60 * 1000),
            anuladoPorId: quienCobra.id,
            motivoAnulacion: "Se cargó dos veces",
          },
        });
      }
      // "Por cobrar" muestra los turnos atendidos desde hace una semana.
      await prisma.clinica.update({
        where: { id: clinicaId },
        data: { pagosDesde: new Date(inicioDeHoy.getTime() - 7 * 24 * 3600 * 1000) },
      });
    }
  }

  console.log("Datos de prueba al día.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
